import { createElement } from 'lwc';

import Test from 'x/test';

it('should return false if attribute is not present', () => {
    const elm = createElement('x-test', { is: Test });
    expect(elm.hasAttribute('foo')).toBeFalse();
});

it('should return true if attribute is present', () => {
    const elm = createElement('x-test', { is: Test });
    elm.setAttribute('foo', 'bar');
    expect(elm.hasAttribute('foo')).toBeTrue();
});
