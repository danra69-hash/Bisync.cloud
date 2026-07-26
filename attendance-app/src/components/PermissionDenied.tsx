export function PermissionDenied({
  title = 'Permission required',
  message = 'Your account does not have permission for this action. Contact an administrator if you need access.',
}: {
  title?: string
  message?: string
}) {
  return (
    <div className="card stack">
      <strong>{title}</strong>
      <p className="muted" style={{ margin: 0 }}>
        {message}
      </p>
    </div>
  )
}
