import express from 'express';
import {
  query,
  id,
  nowIso,
  mapMember,
  mapUser,
  mapAppointment,
  mapLocation,
  loadUserMemberships,
} from './db.mjs';
import {
  buildAttendanceQr,
  parseAttendanceQr,
  parseMemberQr,
  randomFourDigits,
  normalizeTrainingSet,
} from './mobile-domain.mjs';

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function publicSubscriber(account, member) {
  return {
    type: 'subscriber',
    id: account.id,
    email: account.email,
    memberId: account.member_id,
    companyId: account.company_id,
    name: member ? `${member.firstName} ${member.lastName}` : account.email,
    member: member || null,
  };
}

function publicCoach(user, membership) {
  return {
    type: 'coach',
    id: user.id,
    email: user.email,
    name: user.name,
    companyId: membership.companyId,
    role: membership.role,
    locations: membership.locations,
  };
}

async function mobileAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const sess = await query('SELECT * FROM mobile_sessions WHERE token = $1', [token]);
    if (!sess.rowCount) return res.status(401).json({ error: 'Session expired' });
    const row = sess.rows[0];
    req.mobile = {
      token,
      actorType: row.actor_type,
      actorId: row.actor_id,
      companyId: row.company_id,
    };
    if (row.actor_type === 'subscriber') {
      const acc = await query(
        'SELECT * FROM subscriber_accounts WHERE id = $1 AND active = TRUE',
        [row.actor_id],
      );
      if (!acc.rowCount) return res.status(401).json({ error: 'Subscriber inactive' });
      const mem = await query('SELECT * FROM members WHERE id = $1', [acc.rows[0].member_id]);
      req.mobile.account = acc.rows[0];
      req.mobile.member = mapMember(mem.rows[0]);
      req.mobile.user = publicSubscriber(acc.rows[0], req.mobile.member);
    } else {
      const userRes = await query('SELECT * FROM users WHERE id = $1 AND active = TRUE', [
        row.actor_id,
      ]);
      if (!userRes.rowCount) return res.status(401).json({ error: 'Coach inactive' });
      const memberships = await loadUserMemberships(userRes.rows[0].id);
      const membership =
        memberships.find((m) => m.companyId === row.company_id) || memberships[0];
      if (!membership || membership.role !== 'fitness_coach') {
        return res.status(403).json({ error: 'Fitness coach role required' });
      }
      req.mobile.coach = mapUser(userRes.rows[0]);
      req.mobile.membership = membership;
      req.mobile.user = publicCoach(req.mobile.coach, membership);
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function createMobileSession(actorType, actorId, companyId) {
  const token = id('mtok');
  await query(
    `INSERT INTO mobile_sessions (token, actor_type, actor_id, company_id, created_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [token, actorType, actorId, companyId, nowIso()],
  );
  return token;
}

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, service: 'mobile.pulse', time: nowIso() });
  }),
);

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const asRole = String(req.body?.as || req.body?.role || 'auto');

    if (asRole !== 'coach') {
      const acc = await query(
        `SELECT * FROM subscriber_accounts WHERE lower(email) = $1 AND active = TRUE`,
        [email],
      );
      if (acc.rowCount && acc.rows[0].password === password) {
        const mem = mapMember(
          (await query('SELECT * FROM members WHERE id = $1', [acc.rows[0].member_id])).rows[0],
        );
        const token = await createMobileSession('subscriber', acc.rows[0].id, acc.rows[0].company_id);
        return res.json({
          token,
          user: publicSubscriber(acc.rows[0], mem),
          pinRequired: true,
        });
      }
      if (asRole === 'subscriber') {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    const users = await query(
      `SELECT * FROM users WHERE lower(email) = $1 AND active = TRUE`,
      [email],
    );
    const user = mapUser(users.rows[0]);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const memberships = await loadUserMemberships(user.id);
    const coachMembership = memberships.find((m) => m.role === 'fitness_coach');
    if (!coachMembership) {
      return res.status(403).json({ error: 'Not a fitness coach account' });
    }
    const token = await createMobileSession('coach', user.id, coachMembership.companyId);
    res.json({
      token,
      user: publicCoach(user, coachMembership),
      pinRequired: true,
    });
  }),
);

router.post(
  '/auth/pin',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const pin = String(req.body?.pin || '');
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4–6 digits' });
    }
    if (req.mobile.actorType === 'subscriber') {
      if (req.mobile.account.pin !== pin) {
        return res.status(401).json({ error: 'Incorrect PIN' });
      }
    } else {
      let expected = '1234';
      try {
        const u = await query(`SELECT pin FROM users WHERE id = $1`, [req.mobile.actorId]);
        if (u.rows[0]?.pin) expected = String(u.rows[0].pin);
      } catch {
        expected = '1234';
      }
      if (pin !== expected) return res.status(401).json({ error: 'Incorrect PIN' });
    }
    res.json({ ok: true, user: req.mobile.user });
  }),
);

router.post(
  '/auth/logout',
  mobileAuth,
  asyncHandler(async (req, res) => {
    await query('DELETE FROM mobile_sessions WHERE token = $1', [req.mobile.token]);
    res.json({ ok: true });
  }),
);

router.get(
  '/me',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const locations = await query(
      `SELECT * FROM locations WHERE company_id = $1 AND active = TRUE ORDER BY name`,
      [req.mobile.companyId],
    );
    res.json({
      user: req.mobile.user,
      locations: locations.rows.map(mapLocation),
    });
  }),
);

router.get(
  '/packages',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const memberId =
      req.mobile.actorType === 'subscriber'
        ? req.mobile.member.id
        : String(req.query.memberId || '');
    if (!memberId) return res.status(400).json({ error: 'memberId required for coaches' });

    if (req.mobile.actorType === 'coach') {
      const mem = await query('SELECT id FROM members WHERE id = $1 AND company_id = $2', [
        memberId,
        req.mobile.companyId,
      ]);
      if (!mem.rowCount) return res.status(404).json({ error: 'Member not found' });
    }

    const packs = await query(
      `SELECT mp.*, cp.name AS package_name, cp.description AS package_description, cp.price AS package_price
       FROM member_packages mp
       JOIN coaching_packages cp ON cp.id = mp.package_id
       WHERE mp.member_id = $1 AND mp.company_id = $2
       ORDER BY mp.purchased_at DESC`,
      [memberId, req.mobile.companyId],
    );

    const result = [];
    for (const p of packs.rows) {
      const stamps = await query(
        `SELECT * FROM attendance_stamps
         WHERE member_package_id = $1
         ORDER BY stamp_index`,
        [p.id],
      );
      result.push({
        id: p.id,
        packageId: p.package_id,
        name: p.package_name,
        description: p.package_description,
        price: Number(p.package_price),
        stampsTotal: p.stamps_total,
        stampsUsed: p.stamps_used,
        status: p.status,
        purchasedAt: p.purchased_at?.toISOString?.() ?? p.purchased_at,
        stamps: stamps.rows.map((s) => ({
          id: s.id,
          index: s.stamp_index,
          status: s.status,
          qrPayload: s.qr_payload,
          locationId: s.location_id,
          sessionDate: s.session_date,
          sessionTime: s.session_time,
          random4: s.random4,
          confirmedAt: s.confirmed_at?.toISOString?.() ?? s.confirmed_at,
        })),
      });
    }

    const subscription = await query(
      `SELECT m.plan, m.status, m.renews_at, sp.name AS product_name, sp.price, sp.billing_interval
       FROM members m
       LEFT JOIN subscription_products sp
         ON sp.company_id = m.company_id AND sp.plan_code = m.plan
       WHERE m.id = $1`,
      [memberId],
    );
    const sub = subscription.rows[0];
    res.json({
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            renewsAt: sub.renews_at?.toISOString?.() ?? sub.renews_at,
            productName: sub.product_name,
            price: sub.price != null ? Number(sub.price) : null,
            billingInterval: sub.billing_interval,
          }
        : null,
      coachingPackages: result,
      memberQr: `PULSEMEMBER|${memberId}`,
      memberId,
    });
  }),
);

router.get(
  '/members',
  mobileAuth,
  asyncHandler(async (req, res) => {
    if (req.mobile.actorType !== 'coach') {
      return res.status(403).json({ error: 'Coaches only' });
    }
    const { rows } = await query(
      `SELECT * FROM members WHERE company_id = $1 AND status IN ('active','lead')
       ORDER BY first_name, last_name`,
      [req.mobile.companyId],
    );
    res.json(rows.map(mapMember));
  }),
);

/** Members who purchased coaching sessions, with purchased vs used totals. */
router.get(
  '/members/coaching',
  mobileAuth,
  asyncHandler(async (req, res) => {
    if (req.mobile.actorType !== 'coach') {
      return res.status(403).json({ error: 'Coaches only' });
    }
    const { rows } = await query(
      `SELECT m.*,
              COALESCE(SUM(mp.stamps_total), 0)::int AS sessions_purchased,
              COALESCE(SUM(mp.stamps_used), 0)::int AS sessions_used,
              COUNT(mp.id)::int AS package_count
       FROM members m
       JOIN member_packages mp ON mp.member_id = m.id AND mp.company_id = m.company_id
       WHERE m.company_id = $1 AND mp.status IN ('active', 'completed')
       GROUP BY m.id
       HAVING COALESCE(SUM(mp.stamps_total), 0) > 0
       ORDER BY m.first_name, m.last_name`,
      [req.mobile.companyId],
    );
    res.json(
      rows.map((r) => ({
        ...mapMember(r),
        sessionsPurchased: r.sessions_purchased,
        sessionsUsed: r.sessions_used,
        sessionsRemaining: Math.max(0, r.sessions_purchased - r.sessions_used),
        packageCount: r.package_count,
      })),
    );
  }),
);

/**
 * Coach selected a stamp slot, then scanned the member's QR.
 * Accepts PULSEMEMBER|{memberId} or a member-minted attendance PULSE|... QR.
 */
router.post(
  '/attendance/stamp/coach-scan',
  mobileAuth,
  asyncHandler(async (req, res) => {
    if (req.mobile.actorType !== 'coach') {
      return res.status(403).json({ error: 'Coaches only' });
    }
    const { memberPackageId, stampIndex, locationId, qrPayload } = req.body || {};
    if (!memberPackageId || stampIndex == null || !locationId || !qrPayload) {
      return res.status(400).json({
        error: 'memberPackageId, stampIndex, locationId, qrPayload required',
      });
    }

    const pack = await query(
      `SELECT * FROM member_packages WHERE id = $1 AND company_id = $2`,
      [memberPackageId, req.mobile.companyId],
    );
    if (!pack.rowCount) return res.status(404).json({ error: 'Package not found' });
    const memberPackage = pack.rows[0];

    const loc = await query(`SELECT id FROM locations WHERE id = $1 AND company_id = $2`, [
      locationId,
      req.mobile.companyId,
    ]);
    if (!loc.rowCount) return res.status(400).json({ error: 'Invalid location' });

    const stampRes = await query(
      `SELECT * FROM attendance_stamps
       WHERE member_package_id = $1 AND stamp_index = $2`,
      [memberPackageId, Number(stampIndex)],
    );
    if (!stampRes.rowCount) return res.status(404).json({ error: 'Stamp not found' });
    const stamp = stampRes.rows[0];
    if (stamp.status === 'confirmed') {
      return res.status(400).json({ error: 'Stamp already used' });
    }

    const memberQr = parseMemberQr(qrPayload);
    const attendanceQr = parseAttendanceQr(qrPayload);

    if (memberQr) {
      if (memberQr.memberId !== memberPackage.member_id) {
        return res.status(400).json({ error: 'QR member does not match this package' });
      }
    } else if (attendanceQr) {
      if (attendanceQr.stampId !== stamp.id) {
        return res.status(400).json({ error: 'QR stamp does not match selected stamp' });
      }
      if (stamp.qr_payload && stamp.qr_payload !== qrPayload) {
        return res.status(400).json({ error: 'QR does not match stamp challenge' });
      }
      if (stamp.created_by_role === 'coach') {
        return res.status(400).json({
          error: 'Scan the member check-in QR (or a subscriber-minted stamp QR)',
        });
      }
    } else {
      return res.status(400).json({ error: 'Unrecognized QR — expect member or attendance QR' });
    }

    const now = new Date();
    const sessionDate = now.toISOString().slice(0, 10);
    const sessionTime = now.toISOString().slice(11, 16);
    const random4 = stamp.random4 || randomFourDigits();
    const finalPayload =
      attendanceQr && stamp.qr_payload
        ? stamp.qr_payload
        : buildAttendanceQr({
            locationId,
            date: sessionDate,
            time: sessionTime,
            random4,
            stampId: stamp.id,
          });

    await query(
      `UPDATE attendance_stamps SET
         status = 'confirmed',
         location_id = $2,
         session_date = $3,
         session_time = $4,
         random4 = $5,
         qr_payload = $6,
         created_by_role = COALESCE(created_by_role, 'subscriber'),
         created_by_id = COALESCE(created_by_id, $7),
         confirmed_by_role = 'coach',
         confirmed_by_id = $8,
         confirmed_at = $9
       WHERE id = $1`,
      [
        stamp.id,
        locationId,
        sessionDate,
        sessionTime,
        random4,
        finalPayload,
        memberPackage.member_id,
        req.mobile.actorId,
        nowIso(),
      ],
    );
    await query(
      `UPDATE member_packages SET stamps_used = LEAST(stamps_total, stamps_used + 1)
       WHERE id = $1`,
      [memberPackageId],
    );

    res.json({
      ok: true,
      stampId: stamp.id,
      stampIndex: Number(stampIndex),
      memberPackageId,
      memberId: memberPackage.member_id,
      locationId,
      sessionDate,
      sessionTime,
      status: 'confirmed',
    });
  }),
);

router.post(
  '/attendance/stamp/qr',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const { memberPackageId, stampIndex, locationId, sessionDate, sessionTime } = req.body || {};
    if (!memberPackageId || stampIndex == null || !locationId || !sessionDate || !sessionTime) {
      return res.status(400).json({
        error: 'memberPackageId, stampIndex, locationId, sessionDate, sessionTime required',
      });
    }

    const pack = await query(
      `SELECT * FROM member_packages WHERE id = $1 AND company_id = $2`,
      [memberPackageId, req.mobile.companyId],
    );
    if (!pack.rowCount) return res.status(404).json({ error: 'Package not found' });

    if (req.mobile.actorType === 'subscriber' && pack.rows[0].member_id !== req.mobile.member.id) {
      return res.status(403).json({ error: 'Not your package' });
    }

    const stampRes = await query(
      `SELECT * FROM attendance_stamps
       WHERE member_package_id = $1 AND stamp_index = $2`,
      [memberPackageId, Number(stampIndex)],
    );
    if (!stampRes.rowCount) return res.status(404).json({ error: 'Stamp not found' });
    const stamp = stampRes.rows[0];
    if (stamp.status === 'confirmed') {
      return res.status(400).json({ error: 'Stamp already confirmed' });
    }

    const loc = await query(
      `SELECT id FROM locations WHERE id = $1 AND company_id = $2`,
      [locationId, req.mobile.companyId],
    );
    if (!loc.rowCount) return res.status(400).json({ error: 'Invalid location' });

    const random4 = randomFourDigits();
    const qrPayload = buildAttendanceQr({
      locationId,
      date: sessionDate,
      time: sessionTime,
      random4,
      stampId: stamp.id,
    });

    await query(
      `UPDATE attendance_stamps SET
         status = 'pending',
         location_id = $2,
         session_date = $3,
         session_time = $4,
         random4 = $5,
         qr_payload = $6,
         created_by_role = $7,
         created_by_id = $8
       WHERE id = $1`,
      [
        stamp.id,
        locationId,
        sessionDate,
        sessionTime,
        random4,
        qrPayload,
        req.mobile.actorType,
        req.mobile.actorId,
      ],
    );

    res.json({
      stampId: stamp.id,
      qrPayload,
      random4,
      locationId,
      sessionDate,
      sessionTime,
      status: 'pending',
    });
  }),
);

router.post(
  '/attendance/confirm',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const payload = String(req.body?.qrPayload || req.body?.payload || '');
    const parsed = parseAttendanceQr(payload);
    if (!parsed) return res.status(400).json({ error: 'Invalid QR payload' });

    const stampRes = await query(`SELECT * FROM attendance_stamps WHERE id = $1`, [parsed.stampId]);
    if (!stampRes.rowCount) return res.status(404).json({ error: 'Stamp not found' });
    const stamp = stampRes.rows[0];
    if (stamp.company_id !== req.mobile.companyId) {
      return res.status(403).json({ error: 'Wrong company' });
    }
    if (stamp.status === 'confirmed') {
      return res.json({ ok: true, alreadyConfirmed: true, stampId: stamp.id });
    }
    if (
      stamp.qr_payload !== payload ||
      stamp.location_id !== parsed.locationId ||
      stamp.session_date !== parsed.date ||
      stamp.session_time !== parsed.time ||
      stamp.random4 !== parsed.random4
    ) {
      return res.status(400).json({ error: 'QR does not match stamp challenge' });
    }

    // Opposite party confirms
    if (stamp.created_by_role === req.mobile.actorType) {
      return res.status(400).json({ error: 'Counterparty must confirm this QR' });
    }

    const pack = await query(`SELECT * FROM member_packages WHERE id = $1`, [
      stamp.member_package_id,
    ]);
    await query(
      `UPDATE attendance_stamps SET
         status = 'confirmed',
         confirmed_by_role = $2,
         confirmed_by_id = $3,
         confirmed_at = $4
       WHERE id = $1`,
      [stamp.id, req.mobile.actorType, req.mobile.actorId, nowIso()],
    );
    await query(
      `UPDATE member_packages SET stamps_used = LEAST(stamps_total, stamps_used + 1)
       WHERE id = $1`,
      [stamp.member_package_id],
    );

    res.json({
      ok: true,
      stampId: stamp.id,
      memberPackageId: stamp.member_package_id,
      memberId: pack.rows[0]?.member_id,
      locationId: stamp.location_id,
      sessionDate: stamp.session_date,
      sessionTime: stamp.session_time,
    });
  }),
);

router.get(
  '/calendar',
  mobileAuth,
  asyncHandler(async (req, res) => {
    let sql = `
      SELECT a.*, row_to_json(m.*) AS member_row, row_to_json(u.*) AS coach_row
      FROM appointments a
      LEFT JOIN members m ON m.id = a.member_id
      LEFT JOIN users u ON u.id = a.coach_user_id
      WHERE a.company_id = $1`;
    const params = [req.mobile.companyId];
    const scopeAll = String(req.query?.scope || '') === 'all';
    if (req.mobile.actorType === 'subscriber') {
      sql += ` AND a.member_id = $2`;
      params.push(req.mobile.member.id);
    } else if (!scopeAll) {
      sql += ` AND a.coach_user_id = $2`;
      params.push(req.mobile.actorId);
    }
    // Coaches with scope=all see every company appointment on Home.
    sql += ` ORDER BY a.starts_at`;
    const { rows } = await query(sql, params);
    res.json(
      rows.map((r) => ({
        ...mapAppointment(r),
        requestStatus: r.request_status || r.status,
        requestOrigin: r.request_origin || 'subscriber',
        member: mapMember(r.member_row),
        coach: r.coach_row
          ? { id: r.coach_row.id, name: r.coach_row.name, email: r.coach_row.email }
          : null,
      })),
    );
  }),
);

router.get(
  '/coaches/available',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email
       FROM users u
       JOIN user_company_memberships m ON m.user_id = u.id
       WHERE m.company_id = $1 AND m.role = 'fitness_coach' AND u.active = TRUE
       ORDER BY u.name`,
      [req.mobile.companyId],
    );
    res.json(rows);
  }),
);

router.post(
  '/calendar/book',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (!b.startsAt || !b.endsAt || !b.locationId) {
      return res.status(400).json({ error: 'startsAt, endsAt, locationId required' });
    }

    let memberId;
    let coachUserId;
    let requestOrigin;
    let requestStatus;

    if (req.mobile.actorType === 'subscriber') {
      memberId = req.mobile.member.id;
      coachUserId = b.coachUserId;
      if (!coachUserId) return res.status(400).json({ error: 'coachUserId required' });
      requestOrigin = 'subscriber';
      requestStatus = 'scheduled';
    } else {
      memberId = b.memberId;
      if (!memberId) return res.status(400).json({ error: 'memberId required' });
      coachUserId = req.mobile.actorId;
      requestOrigin = 'coach';
      // Home "Add appointment" confirms immediately; Calendar tab can still request accept.
      const confirm =
        b.scheduled === true ||
        b.confirm === true ||
        String(b.requestStatus || b.status || '').toLowerCase() === 'scheduled';
      requestStatus = confirm ? 'scheduled' : 'pending';
    }

    const appointment = {
      id: id('apt'),
      companyId: req.mobile.companyId,
      locationId: b.locationId,
      memberId,
      coachUserId,
      title: String(b.title || 'Training session'),
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      status: requestStatus === 'pending' ? 'pending' : 'scheduled',
      area: String(b.area || ''),
      notes: String(b.notes || ''),
    };

    await query(
      `INSERT INTO appointments
        (id, company_id, location_id, member_id, coach_user_id, title, starts_at, ends_at, status, area, notes, request_origin, request_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        appointment.id,
        appointment.companyId,
        appointment.locationId,
        appointment.memberId,
        appointment.coachUserId,
        appointment.title,
        appointment.startsAt,
        appointment.endsAt,
        appointment.status,
        appointment.area,
        appointment.notes,
        requestOrigin,
        requestStatus,
      ],
    );
    res.status(201).json({ ...appointment, requestOrigin, requestStatus });
  }),
);

router.post(
  '/calendar/:id/respond',
  mobileAuth,
  asyncHandler(async (req, res) => {
    if (req.mobile.actorType !== 'subscriber') {
      return res.status(403).json({ error: 'Subscribers accept coach requests' });
    }
    const accept = Boolean(req.body?.accept);
    const cur = await query(
      `SELECT * FROM appointments WHERE id = $1 AND company_id = $2 AND member_id = $3`,
      [req.params.id, req.mobile.companyId, req.mobile.member.id],
    );
    if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
    const status = accept ? 'scheduled' : 'declined';
    await query(
      `UPDATE appointments SET status = $2, request_status = $2 WHERE id = $1`,
      [req.params.id, status],
    );
    res.json({ ok: true, status });
  }),
);

router.get(
  '/training/active',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM mobile_training_sessions
       WHERE company_id = $1 AND owner_type = $2 AND owner_id = $3 AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
      [req.mobile.companyId, req.mobile.actorType, req.mobile.actorId],
    );
    if (!rows.length) return res.json(null);
    const session = rows[0];
    const sets = await query(
      `SELECT * FROM mobile_training_sets WHERE session_id = $1 ORDER BY set_index`,
      [session.id],
    );
    res.json(mapMobileSession(session, sets.rows));
  }),
);

function mapMobileSession(session, setRows = []) {
  return {
    id: session.id,
    companyId: session.company_id,
    locationId: session.location_id,
    memberId: session.member_id,
    coachUserId: session.coach_user_id,
    ownerType: session.owner_type,
    ownerId: session.owner_id,
    status: session.status,
    attendanceStampId: session.attendance_stamp_id,
    startedAt: session.started_at?.toISOString?.() ?? session.started_at,
    endedAt: session.ended_at?.toISOString?.() ?? session.ended_at,
    endQrPayload: session.end_qr_payload,
    endRandom4: session.end_random4,
    notes: session.notes,
    sets: setRows.map((s) => ({
      id: s.id,
      setIndex: s.set_index,
      modality: s.modality,
      equipmentId: s.equipment_id,
      equipmentName: s.equipment_name,
      weight: s.weight != null ? Number(s.weight) : null,
      reps: s.reps,
      setsCount: s.sets_count,
      speed: s.speed != null ? Number(s.speed) : null,
      incline: s.incline != null ? Number(s.incline) : null,
      durationSec: s.duration_sec,
    })),
  };
}

router.post(
  '/training/start',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const locationId = b.locationId;
    if (!locationId) return res.status(400).json({ error: 'locationId required' });

    let memberId;
    let coachUserId = null;
    let attendanceStampId = b.attendanceStampId || null;

    if (req.mobile.actorType === 'subscriber') {
      memberId = req.mobile.member.id;
      coachUserId = b.coachUserId || null;
    } else {
      memberId = b.memberId;
      if (!memberId) return res.status(400).json({ error: 'memberId required' });
      coachUserId = req.mobile.actorId;
      // Coach must have confirmed attendance before logging details
      if (!attendanceStampId) {
        return res.status(400).json({
          error: 'Confirm attendance stamp (QR) before starting coach training log',
        });
      }
      const stamp = await query(
        `SELECT * FROM attendance_stamps WHERE id = $1 AND company_id = $2`,
        [attendanceStampId, req.mobile.companyId],
      );
      if (!stamp.rowCount || stamp.rows[0].status !== 'confirmed') {
        return res.status(400).json({ error: 'Attendance must be confirmed first' });
      }
    }

    // End any prior active session for this owner
    await query(
      `UPDATE mobile_training_sessions SET status = 'abandoned', ended_at = NOW()
       WHERE company_id = $1 AND owner_type = $2 AND owner_id = $3 AND status = 'active'`,
      [req.mobile.companyId, req.mobile.actorType, req.mobile.actorId],
    );

    const session = {
      id: id('mtrn'),
      companyId: req.mobile.companyId,
      locationId,
      memberId,
      coachUserId,
      ownerType: req.mobile.actorType,
      ownerId: req.mobile.actorId,
      status: 'active',
      attendanceStampId,
      startedAt: nowIso(),
      notes: String(b.notes || ''),
    };
    await query(
      `INSERT INTO mobile_training_sessions
        (id, company_id, location_id, member_id, coach_user_id, owner_type, owner_id, status, attendance_stamp_id, started_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        session.id,
        session.companyId,
        session.locationId,
        session.memberId,
        session.coachUserId,
        session.ownerType,
        session.ownerId,
        session.status,
        session.attendanceStampId,
        session.startedAt,
        session.notes,
      ],
    );
    res.status(201).json(mapMobileSession(session, []));
  }),
);

router.post(
  '/training/:id/sets',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const sessionRes = await query(
      `SELECT * FROM mobile_training_sessions
       WHERE id = $1 AND company_id = $2 AND owner_type = $3 AND owner_id = $4 AND status = 'active'`,
      [req.params.id, req.mobile.companyId, req.mobile.actorType, req.mobile.actorId],
    );
    if (!sessionRes.rowCount) return res.status(404).json({ error: 'Active session not found' });

    const normalized = normalizeTrainingSet(req.body || {});
    if (!normalized.ok) return res.status(400).json({ error: normalized.error });

    const count = await query(
      `SELECT COUNT(*)::int AS n FROM mobile_training_sets WHERE session_id = $1`,
      [req.params.id],
    );
    const setIndex = count.rows[0].n + 1;
    const setId = id('mset');
    const v = normalized.value;
    await query(
      `INSERT INTO mobile_training_sets
        (id, session_id, set_index, modality, equipment_id, equipment_name, weight, reps, sets_count, speed, incline, duration_sec)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        setId,
        req.params.id,
        setIndex,
        v.modality,
        req.body?.equipmentId || null,
        String(req.body?.equipmentName || ''),
        v.weight,
        v.reps,
        v.setsCount,
        v.speed,
        v.incline,
        v.durationSec,
      ],
    );
    const sets = await query(
      `SELECT * FROM mobile_training_sets WHERE session_id = $1 ORDER BY set_index`,
      [req.params.id],
    );
    res.status(201).json(mapMobileSession(sessionRes.rows[0], sets.rows));
  }),
);

router.post(
  '/training/:id/end',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const sessionRes = await query(
      `SELECT * FROM mobile_training_sessions
       WHERE id = $1 AND company_id = $2 AND owner_type = $3 AND owner_id = $4 AND status = 'active'`,
      [req.params.id, req.mobile.companyId, req.mobile.actorType, req.mobile.actorId],
    );
    if (!sessionRes.rowCount) return res.status(404).json({ error: 'Active session not found' });
    const session = sessionRes.rows[0];

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 16);
    const random4 = randomFourDigits();
    const endQr = buildAttendanceQr({
      locationId: session.location_id,
      date,
      time,
      random4,
      stampId: session.id,
    });

    await query(
      `UPDATE mobile_training_sessions SET
         status = 'ended', ended_at = $2, end_qr_payload = $3, end_random4 = $4
       WHERE id = $1`,
      [session.id, nowIso(), endQr, random4],
    );

    const sets = await query(
      `SELECT * FROM mobile_training_sets WHERE session_id = $1 ORDER BY set_index`,
      [session.id],
    );
    const updated = (
      await query(`SELECT * FROM mobile_training_sessions WHERE id = $1`, [session.id])
    ).rows[0];
    res.json({
      session: mapMobileSession(updated, sets.rows),
      endQrPayload: endQr,
      endRandom4: random4,
    });
  }),
);

router.post(
  '/training/end/confirm',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const payload = String(req.body?.qrPayload || '');
    const parsed = parseAttendanceQr(payload);
    if (!parsed) return res.status(400).json({ error: 'Invalid end QR' });
    const sessionRes = await query(
      `SELECT * FROM mobile_training_sessions WHERE id = $1 AND company_id = $2`,
      [parsed.stampId, req.mobile.companyId],
    );
    if (!sessionRes.rowCount) return res.status(404).json({ error: 'Session not found' });
    const session = sessionRes.rows[0];
    if (session.end_qr_payload !== payload) {
      return res.status(400).json({ error: 'QR mismatch' });
    }
    // Subscriber confirms coach-ended session (or vice versa)
    if (session.owner_type === req.mobile.actorType) {
      return res.status(400).json({ error: 'Counterparty must confirm end QR' });
    }
    await query(
      `UPDATE mobile_training_sessions SET status = 'confirmed' WHERE id = $1`,
      [session.id],
    );
    res.json({ ok: true, sessionId: session.id });
  }),
);

router.get(
  '/equipment',
  mobileAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, code, name, category, status, location_id, area
       FROM equipment WHERE company_id = $1 ORDER BY name`,
      [req.mobile.companyId],
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        status: r.status,
        locationId: r.location_id,
        area: r.area,
      })),
    );
  }),
);

export function mountMobileRoutes(app) {
  app.use('/api/mobile', router);
}

export default router;
