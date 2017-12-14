import * as parse5 from 'parse5-with-errors';
import * as camelcase from 'camelcase';

import {
    EXPRESSION_SYMBOL_END,
    EXPRESSION_SYMBOL_START,
    isExpression,
    isPotentialExpression,
} from './expression';

import {
    IRElement,
} from '../shared/types';

import {
    SVG_TAG_SET,
    DATA_ARIA_RE,
    GLOBAL_ATTRIBUTE_SET,
    ATTRS_PROPS_TRANFORMS,
    HTML_ATTRIBUTES_REVERSE_LOOKUP,
    DASHED_TAGNAME_ELEMENT_SET,
} from './constants';

import {
    isCustomElement,
} from '../shared/ir';

function isQuotedAttribute(rawAttribute: string) {
    const [, value] = rawAttribute.split('=');
    return value && value.startsWith('"') && value.endsWith('"');
}

function isEscapedAttribute(rawAttribute: string) {
    const [, value] = rawAttribute.split('=');
    return !value || !(value.includes('{') && value.includes('}'));
}

export function normalizeAttributeValue(
    attr: parse5.AST.Default.Attribute,
    raw: string,
): {
    value: string,
    escapedExpression: boolean,
} {
    const { value } = attr;
    const isQuoted = isQuotedAttribute(raw);
    const isEscaped = isEscapedAttribute(raw);
    if (!isEscaped && isExpression(value)) {
        if (isQuoted) {
            // <input value="{myValue}" />
            // -> ambiguity if the attribute value is a template identifier or a string literal.

            const unquoted = raw.replace(/"/g, '');
            const escaped = raw.replace('"{', '"\\{');

            const err = new Error([
                `Ambiguous attribute value ${raw}.`,
                `If you want to make it a valid identifier you should remove the surrounding quotes ${unquoted}.`,
                `If you want to make it a string you should escape it ${escaped}.`,
            ].join(' '));

            throw err;
        }

        // <input value={myValue} />
        // -> Valid identifier.
        return { value, escapedExpression: false };
    } else if (!isEscaped && isPotentialExpression(value)) {

        const isExpressionEscaped = value.startsWith(`\\${EXPRESSION_SYMBOL_START}`);
        const isExpressionNextToSelfClosing = value.startsWith(EXPRESSION_SYMBOL_START)
            && value.endsWith(`${EXPRESSION_SYMBOL_END}/`)
            && !isQuoted;

        if (isExpressionNextToSelfClosing) {
            // <input value={myValue}/>
            // -> By design the html parser consider the / as the last character of the attribute value.
            //    Make sure to remove strip the trailing / for self closing elements.

            return { value: value.slice(0, -1), escapedExpression: false };
        } else if (isExpressionEscaped) {
            // <input value="\{myValue}"/>
            // -> Valid escaped string literal

            return { value: value.slice(1), escapedExpression: true };
        }

        let escaped = raw.replace(/="?/, '="\\');
        escaped += escaped.endsWith('"') ? '' : '"';

        // Throw if the attribute value looks like an expression, but it can't be resolved by the compiler.
        throw new Error(
            `Ambiguous attribute value ${raw}. If you want to make it a string you should escape it ${escaped}`,
        );
    }

    // <input value="myValue"/>
    // -> Valid string literal.
    return { value, escapedExpression: false };
}

export function attributeName(attr: parse5.AST.Default.Attribute): string {
    const { prefix, name } = attr;
    return prefix ? `${prefix}:${name}` : name;
}

export function getAttribute(el: IRElement, pattern: string | RegExp): parse5.AST.Default.Attribute | undefined {
    return el.attrsList.find((attr) => (
        typeof pattern === 'string' ?
            attributeName(attr) === pattern :
            !!attributeName(attr).match(pattern)
    ));
}

export function removeAttribute(el: IRElement, pattern: string | RegExp): void {
    el.attrsList = el.attrsList.filter((attr) => (
        typeof pattern === 'string' ?
            attributeName(attr) !== pattern :
            !attributeName(attr).match(pattern)
    ));
}

export function isAriaOrDataOrFmkAttribute(attrName: string): boolean {
    return (
        attrName === 'role' ||
        attrName === 'is' ||
        attrName === 'key' ||
        attrName === 'slot' ||
        !!attrName.match(DATA_ARIA_RE)
    );
}

function isInputStateAttribute(element: IRElement, attrName: string) {
    return element.tag === 'input' && (attrName === 'value' || attrName === 'checked');
}

export function isAttribute(element: IRElement, attrName: string): boolean {
    // Handle global attrs (common to all tags) and special attribute (role, aria, key, is, data-).
    if (GLOBAL_ATTRIBUTE_SET.has(attrName) || isAriaOrDataOrFmkAttribute(attrName)) {
        return true;
    }

    // Handle input tag value="" and checked attributes that are only used for state initialization.
    // Because .setAttribute() won't update the value, those attributes should be considered as props.
    if (isInputStateAttribute(element, attrName)) {
        return false;
    }

    // Handle attributes applied to a subclassed element via the is="" attribute.
    // Returns true only attributes that are valid attribute for the base element.
    const hasIsAttr = !!getAttribute(element, 'is');
    if (hasIsAttr) {
        return isValidHTMLAttribute(element.tag, attrName);
    }

    // Handle general case where only standard element have attribute value.
    return !isCustomElement(element);
}

export function isValidHTMLAttribute(tagName: string, attrName: string): boolean {
    if (GLOBAL_ATTRIBUTE_SET.has(attrName) ||
        isAriaOrDataOrFmkAttribute(attrName) ||
        SVG_TAG_SET.has(tagName) ||
        DASHED_TAGNAME_ELEMENT_SET.has(tagName)) {
        return true;
    }

    const validElements = HTML_ATTRIBUTES_REVERSE_LOOKUP[attrName];
    return !!validElements &&  (!validElements.length || validElements.includes(tagName));
}

export function attributeToPropertyName(element: IRElement, attrName: string): string {
    const { tag } = element;

    let propName = attrName;
    if (!SVG_TAG_SET.has(tag) && !isAriaOrDataOrFmkAttribute(attrName) && !isCustomElement(element)) {
        propName = ATTRS_PROPS_TRANFORMS[propName] || propName;
    }

    return camelcase(propName);
}