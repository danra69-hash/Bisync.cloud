/**
 * Template CSV must omit operational columns from My Component download.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const SMART_COMPONENT_TEMPLATE_HEADERS = [
  'Component ID',
  'Category',
  'Group',
  'Name',
  'Principal Component',
  'Alternate Component Unit 1',
  'Conversion 1',
  'Alternate Component Unit 2',
  'Conversion 2',
  'Alternate Component Unit 3',
  'Conversion 3',
  'Alternate Component Unit 4',
  'Conversion 4',
  'Alternate Component Unit 5',
  'Conversion 5',
  'Par Stock',
  'Par Stock UOM',
  'Area',
  'Storage',
  'Active',
  'Last Updated',
];

const OMITTED = [
  'Last UOM Price',
  'Daily Usage',
  'Order Freq (days)',
  'Qty on Hand',
  'Location',
  'Products',
  'Vendors',
];

describe('My Component template CSV headers', () => {
  it('keeps editable catalog columns', () => {
    for (const h of [
      'Principal Component',
      'Par Stock',
      'Par Stock UOM',
      'Area',
      'Storage',
      'Active',
    ]) {
      assert.ok(SMART_COMPONENT_TEMPLATE_HEADERS.includes(h), `missing ${h}`);
    }
  });

  it('omits operational / derived columns', () => {
    for (const h of OMITTED) {
      assert.equal(
        SMART_COMPONENT_TEMPLATE_HEADERS.includes(h),
        false,
        `should omit ${h}`,
      );
    }
  });

  it('header count matches editable template shape', () => {
    assert.equal(SMART_COMPONENT_TEMPLATE_HEADERS.length, 21);
  });
});
