/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { hasOwnProperty } from '@lwc/shared';

const { appendChild, insertBefore, replaceChild, removeChild } = Node.prototype;

const useSyntheticShadow = hasOwnProperty.call(Element.prototype, '$shadowToken$');

export { appendChild, insertBefore, replaceChild, removeChild, useSyntheticShadow };