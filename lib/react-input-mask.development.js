'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var React = _interopDefault(require('react'));
var reactDom = require('react-dom');
var invariant = _interopDefault(require('invariant'));

function setInputSelection(input, start, end) {
  if ('selectionStart' in input && 'selectionEnd' in input) {
    input.selectionStart = start;
    input.selectionEnd = end;
  } else {
    var range = input.createTextRange();
    range.collapse(true);
    range.moveStart('character', start);
    range.moveEnd('character', end - start);
    range.select();
  }
}

function getInputSelection(input) {
  var start = 0;
  var end = 0;

  if ('selectionStart' in input && 'selectionEnd' in input) {
    start = input.selectionStart;
    end = input.selectionEnd;
  } else {
    var range = document.selection.createRange();
    if (range.parentElement() === input) {
      start = -range.moveStart('character', -input.value.length);
      end = -range.moveEnd('character', -input.value.length);
    }
  }

  return {
    start: start,
    end: end,
    length: end - start
  };
}

var defaultFormatChars = {
  '9': '[0-9]',
  'a': '[A-Za-z]',
  '*': '[A-Za-z0-9]'
};

var defaultMaskChar = '_';

function parseMask (mask, maskChar, formatChars) {
  var parsedMaskString = '';
  var prefix = '';
  var lastEditablePosition = null;
  var permanents = [];

  if (maskChar === undefined) {
    maskChar = defaultMaskChar;
  }

  if (formatChars == null) {
    formatChars = defaultFormatChars;
  }

  if (!mask || typeof mask !== 'string') {
    return {
      maskChar: maskChar,
      formatChars: formatChars,
      mask: null,
      prefix: null,
      lastEditablePosition: null,
      permanents: []
    };
  }

  var isPermanent = false;
  mask.split('').forEach(function (character) {
    if (!isPermanent && character === '\\') {
      isPermanent = true;
    } else {
      if (isPermanent || !formatChars[character]) {
        permanents.push(parsedMaskString.length);
        if (parsedMaskString.length === permanents.length - 1) {
          prefix += character;
        }
      } else {
        lastEditablePosition = parsedMaskString.length + 1;
      }
      parsedMaskString += character;
      isPermanent = false;
    }
  });

  return {
    maskChar: maskChar,
    formatChars: formatChars,
    prefix: prefix,
    mask: parsedMaskString,
    lastEditablePosition: lastEditablePosition,
    permanents: permanents
  };
}

/* eslint no-use-before-define: ["error", { functions: false }] */

function isPermanentCharacter(maskOptions, pos) {
  return maskOptions.permanents.indexOf(pos) !== -1;
}

function isAllowedCharacter(maskOptions, pos, character) {
  var mask = maskOptions.mask,
      formatChars = maskOptions.formatChars;

  if (!character) {
    return false;
  }

  if (isPermanentCharacter(maskOptions, pos)) {
    return mask[pos] === character;
  }

  var ruleChar = mask[pos];
  var charRule = formatChars[ruleChar];

  return new RegExp(charRule).test(character);
}

function isEmpty(maskOptions, value) {
  return value.split('').every(function (character, i) {
    return isPermanentCharacter(maskOptions, i) || !isAllowedCharacter(maskOptions, i, character);
  });
}

function getFilledLength(maskOptions, value) {
  var maskChar = maskOptions.maskChar,
      prefix = maskOptions.prefix;

  if (!maskChar) {
    while (value.length > prefix.length && isPermanentCharacter(maskOptions, value.length - 1)) {
      value = value.slice(0, value.length - 1);
    }
    return value.length;
  }

  var filledLength = prefix.length;
  for (var i = value.length; i >= prefix.length; i--) {
    var character = value[i];
    var isEnteredCharacter = !isPermanentCharacter(maskOptions, i) && isAllowedCharacter(maskOptions, i, character);
    if (isEnteredCharacter) {
      filledLength = i + 1;
      break;
    }
  }

  return filledLength;
}

function isFilled(maskOptions, value) {
  return getFilledLength(maskOptions, value) === maskOptions.mask.length;
}

function formatValue(maskOptions, value) {
  var maskChar = maskOptions.maskChar,
      mask = maskOptions.mask,
      prefix = maskOptions.prefix;

  if (!maskChar) {
    value = insertString(maskOptions, '', value, 0);

    if (value.length < prefix.length) {
      value = prefix;
    }

    while (value.length < mask.length && isPermanentCharacter(maskOptions, value.length)) {
      value += mask[value.length];
    }

    return value;
  }

  if (value) {
    var emptyValue = formatValue(maskOptions, '');
    return insertString(maskOptions, emptyValue, value, 0);
  }

  for (var i = 0; i < mask.length; i++) {
    if (isPermanentCharacter(maskOptions, i)) {
      value += mask[i];
    } else {
      value += maskChar;
    }
  }

  return value;
}

function clearRange(maskOptions, value, start, len) {
  var end = start + len;
  var maskChar = maskOptions.maskChar,
      mask = maskOptions.mask,
      prefix = maskOptions.prefix;

  var arrayValue = value.split('');

  if (!maskChar) {
    // remove any permanent chars after clear range, they will be added back by formatValue
    for (var i = end; i < arrayValue.length; i++) {
      if (isPermanentCharacter(maskOptions, i)) {
        arrayValue[i] = '';
      }
    }

    start = Math.max(prefix.length, start);
    arrayValue.splice(start, end - start);
    value = arrayValue.join('');

    return formatValue(maskOptions, value);
  }

  return arrayValue.map(function (character, i) {
    if (i < start || i >= end) {
      return character;
    }
    if (isPermanentCharacter(maskOptions, i)) {
      return mask[i];
    }
    return maskChar;
  }).join('');
}

function insertString(maskOptions, value, insertStr, insertPosition) {
  var mask = maskOptions.mask,
      maskChar = maskOptions.maskChar,
      prefix = maskOptions.prefix;

  var arrayInsertStr = insertStr.split('');
  var isInputFilled = isFilled(maskOptions, value);

  var isUsablePosition = function isUsablePosition(pos, character) {
    return !isPermanentCharacter(maskOptions, pos) || character === mask[pos];
  };
  var isUsableCharacter = function isUsableCharacter(character, pos) {
    return !maskChar || !isPermanentCharacter(maskOptions, pos) || character !== maskChar;
  };

  if (!maskChar && insertPosition > value.length) {
    value += mask.slice(value.length, insertPosition);
  }

  arrayInsertStr.every(function (insertCharacter) {
    while (!isUsablePosition(insertPosition, insertCharacter)) {
      if (insertPosition >= value.length) {
        value += mask[insertPosition];
      }

      if (!isUsableCharacter(insertCharacter, insertPosition)) {
        return true;
      }

      insertPosition++;

      // stop iteration if maximum value length reached
      if (insertPosition >= mask.length) {
        return false;
      }
    }

    var isAllowed = isAllowedCharacter(maskOptions, insertPosition, insertCharacter) || insertCharacter === maskChar;
    if (!isAllowed) {
      return true;
    }

    if (insertPosition < value.length) {
      if (maskChar || isInputFilled || insertPosition < prefix.length) {
        value = value.slice(0, insertPosition) + insertCharacter + value.slice(insertPosition + 1);
      } else {
        value = value.slice(0, insertPosition) + insertCharacter + value.slice(insertPosition);
        value = formatValue(maskOptions, value);
      }
    } else if (!maskChar) {
      value += insertCharacter;
    }

    insertPosition++;

    // stop iteration if maximum value length reached
    return insertPosition < mask.length;
  });

  return value;
}

function getInsertStringLength(maskOptions, value, insertStr, insertPosition) {
  var mask = maskOptions.mask,
      maskChar = maskOptions.maskChar;

  var arrayInsertStr = insertStr.split('');
  var initialInsertPosition = insertPosition;

  var isUsablePosition = function isUsablePosition(pos, character) {
    return !isPermanentCharacter(maskOptions, pos) || character === mask[pos];
  };

  arrayInsertStr.every(function (insertCharacter) {
    while (!isUsablePosition(insertPosition, insertCharacter)) {
      insertPosition++;

      // stop iteration if maximum value length reached
      if (insertPosition >= mask.length) {
        return false;
      }
    }

    var isAllowed = isAllowedCharacter(maskOptions, insertPosition, insertCharacter) || insertCharacter === maskChar;

    if (isAllowed) {
      insertPosition++;
    }

    // stop iteration if maximum value length reached
    return insertPosition < mask.length;
  });

  return insertPosition - initialInsertPosition;
}

function getLeftEditablePosition(maskOptions, pos) {
  for (var i = pos; i >= 0; --i) {
    if (!isPermanentCharacter(maskOptions, i)) {
      return i;
    }
  }
  return null;
}

function getRightEditablePosition(maskOptions, pos) {
  var mask = maskOptions.mask;

  for (var i = pos; i < mask.length; ++i) {
    if (!isPermanentCharacter(maskOptions, i)) {
      return i;
    }
  }
  return null;
}

function getStringValue(value) {
  return !value && value !== 0 ? '' : value + '';
}

function processChange(maskOptions, value, selection, previousValue, previousSelection) {
  var mask = maskOptions.mask,
      prefix = maskOptions.prefix,
      lastEditablePosition = maskOptions.lastEditablePosition;

  var newValue = value;
  var enteredString = '';
  var formattedEnteredStringLength = 0;
  var removedLength = 0;
  var cursorPosition = Math.min(previousSelection.start, selection.start);

  if (selection.end > previousSelection.start) {
    enteredString = newValue.slice(previousSelection.start, selection.end);
    formattedEnteredStringLength = getInsertStringLength(maskOptions, previousValue, enteredString, cursorPosition);
    if (!formattedEnteredStringLength) {
      removedLength = 0;
    } else {
      removedLength = previousSelection.length;
    }
  } else if (newValue.length < previousValue.length) {
    removedLength = previousValue.length - newValue.length;
  }

  newValue = previousValue;

  if (removedLength) {
    if (removedLength === 1 && !previousSelection.length) {
      var deleteFromRight = previousSelection.start === selection.start;
      cursorPosition = deleteFromRight ? getRightEditablePosition(maskOptions, selection.start) : getLeftEditablePosition(maskOptions, selection.start);
    }
    newValue = clearRange(maskOptions, newValue, cursorPosition, removedLength);
  }

  newValue = insertString(maskOptions, newValue, enteredString, cursorPosition);

  cursorPosition = cursorPosition + formattedEnteredStringLength;
  if (cursorPosition >= mask.length) {
    cursorPosition = mask.length;
  } else if (cursorPosition < prefix.length && !formattedEnteredStringLength) {
    cursorPosition = prefix.length;
  } else if (cursorPosition >= prefix.length && cursorPosition < lastEditablePosition && formattedEnteredStringLength) {
    cursorPosition = getRightEditablePosition(maskOptions, cursorPosition);
  }

  newValue = formatValue(maskOptions, newValue);

  if (!enteredString) {
    enteredString = null;
  }

  return {
    value: newValue,
    enteredString: enteredString,
    selection: { start: cursorPosition, end: cursorPosition }
  };
}

function isWindowsPhoneBrowser() {
  var windows = new RegExp('windows', 'i');
  var phone = new RegExp('phone', 'i');
  var ua = navigator.userAgent;
  return windows.test(ua) && phone.test(ua);
}

function isFunction(value) {
  return typeof value === 'function';
}

function getRequestAnimationFrame() {
  return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
}

function getCancelAnimationFrame() {
  return window.cancelAnimationFrame || window.webkitCancelRequestAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame;
}

function defer(fn) {
  var hasCancelAnimationFrame = !!getCancelAnimationFrame();
  var deferFn = void 0;

  if (hasCancelAnimationFrame) {
    deferFn = getRequestAnimationFrame();
  } else {
    deferFn = function deferFn() {
      return setTimeout(fn, 1000 / 60);
    };
  }

  return deferFn(fn);
}

function cancelDefer(deferId) {
  var cancelFn = getCancelAnimationFrame() || clearTimeout;

  cancelFn(deferId);
}

function _defaults(obj, defaults) { var keys = Object.getOwnPropertyNames(defaults); for (var i = 0; i < keys.length; i++) { var key = keys[i]; var value = Object.getOwnPropertyDescriptor(defaults, key); if (value && value.configurable && obj[key] === undefined) { Object.defineProperty(obj, key, value); } } return obj; }

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }return target;
};

function _objectWithoutProperties(obj, keys) {
  var target = {};for (var i in obj) {
    if (keys.indexOf(i) >= 0) continue;if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;target[i] = obj[i];
  }return target;
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : _defaults(subClass, superClass);
}

var InputElement = function (_React$Component) {
  _inherits(InputElement, _React$Component);

  function InputElement(props) {
    _classCallCheck(this, InputElement);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props));

    _initialiseProps.call(_this);

    var mask = props.mask,
        maskChar = props.maskChar,
        formatChars = props.formatChars,
        alwaysShowMask = props.alwaysShowMask,
        beforeMaskedValueChange = props.beforeMaskedValueChange;
    var defaultValue = props.defaultValue,
        value = props.value;

    _this.maskOptions = parseMask(mask, maskChar, formatChars);

    if (defaultValue == null) {
      defaultValue = '';
    }
    if (value == null) {
      value = defaultValue;
    }

    var newValue = getStringValue(value);

    if (_this.maskOptions.mask && (alwaysShowMask || newValue)) {
      newValue = formatValue(_this.maskOptions, newValue);

      if (isFunction(beforeMaskedValueChange)) {
        var oldValue = props.value;
        if (props.value == null) {
          oldValue = defaultValue;
        }
        oldValue = getStringValue(oldValue);

        var modifiedValue = beforeMaskedValueChange({ value: newValue, selection: null }, { value: oldValue, selection: null }, null, _this.getBeforeMaskedValueChangeConfig());

        newValue = modifiedValue.value;
      }
    }

    _this.value = newValue;
    return _this;
  }

  InputElement.prototype.componentDidMount = function componentDidMount() {
    this.mounted = true;

    // workaround for react-test-renderer
    // https://github.com/sanniassin/react-input-mask/issues/147
    if (!this.getInputDOMNode()) {
      return;
    }

    this.isWindowsPhoneBrowser = isWindowsPhoneBrowser();

    if (this.maskOptions.mask && this.getInputValue() !== this.value) {
      this.setInputValue(this.value);
    }
  };

  InputElement.prototype.componentDidUpdate = function componentDidUpdate() {
    var previousSelection = this.previousSelection;
    var _props = this.props,
        beforeMaskedValueChange = _props.beforeMaskedValueChange,
        alwaysShowMask = _props.alwaysShowMask,
        mask = _props.mask,
        maskChar = _props.maskChar,
        formatChars = _props.formatChars;

    var previousMaskOptions = this.maskOptions;
    var showEmpty = alwaysShowMask || this.isFocused();
    var hasValue = this.props.value != null;
    var newValue = hasValue ? getStringValue(this.props.value) : this.value;
    var cursorPosition = previousSelection ? previousSelection.start : null;

    this.maskOptions = parseMask(mask, maskChar, formatChars);

    if (!this.maskOptions.mask) {
      if (previousMaskOptions.mask) {
        this.stopSaveSelectionLoop();

        // render depends on this.maskOptions and this.value,
        // call forceUpdate to keep it in sync
        this.forceUpdate();
      }
      return;
    } else if (!previousMaskOptions.mask && this.isFocused()) {
      this.runSaveSelectionLoop();
    }

    var isMaskChanged = this.maskOptions.mask && this.maskOptions.mask !== previousMaskOptions.mask;

    if (!previousMaskOptions.mask && !hasValue) {
      newValue = this.getInputValue();
    }

    if (isMaskChanged || this.maskOptions.mask && (newValue || showEmpty)) {
      newValue = formatValue(this.maskOptions, newValue);
    }

    if (isMaskChanged) {
      var filledLength = getFilledLength(this.maskOptions, newValue);
      if (cursorPosition === null || filledLength < cursorPosition) {
        if (isFilled(this.maskOptions, newValue)) {
          cursorPosition = filledLength;
        } else {
          cursorPosition = getRightEditablePosition(this.maskOptions, filledLength);
        }
      }
    }

    if (this.maskOptions.mask && isEmpty(this.maskOptions, newValue) && !showEmpty && (!hasValue || !this.props.value)) {
      newValue = '';
    }

    var newSelection = { start: cursorPosition, end: cursorPosition };

    if (isFunction(beforeMaskedValueChange)) {
      var modifiedValue = beforeMaskedValueChange({ value: newValue, selection: newSelection }, { value: this.value, selection: this.previousSelection }, null, this.getBeforeMaskedValueChangeConfig());
      newValue = modifiedValue.value;
      newSelection = modifiedValue.selection;
    }

    this.value = newValue;

    // render depends on this.maskOptions and this.value,
    // call forceUpdate to keep it in sync
    if (this.getInputValue() !== this.value) {
      this.setInputValue(this.value);
      this.forceUpdate();
    } else if (isMaskChanged) {
      this.forceUpdate();
    }

    var isSelectionChanged = false;
    if (newSelection.start != null && newSelection.end != null) {
      isSelectionChanged = !previousSelection || previousSelection.start !== newSelection.start || previousSelection.end !== newSelection.end;
    }

    if (isSelectionChanged) {
      this.setSelection(newSelection.start, newSelection.end);
    }
  };

  InputElement.prototype.componentWillUnmount = function componentWillUnmount() {
    this.mounted = false;
    if (this.selectionDeferId !== null) {
      cancelDefer(this.selectionDeferId);
    }
    this.stopSaveSelectionLoop();
  };

  InputElement.prototype.render = function render() {
    var _props2 = this.props,
        mask = _props2.mask,
        alwaysShowMask = _props2.alwaysShowMask,
        maskChar = _props2.maskChar,
        formatChars = _props2.formatChars,
        inputRef = _props2.inputRef,
        beforeMaskedValueChange = _props2.beforeMaskedValueChange,
        children = _props2.children,
        restProps = _objectWithoutProperties(_props2, ['mask', 'alwaysShowMask', 'maskChar', 'formatChars', 'inputRef', 'beforeMaskedValueChange', 'children']);

    var inputElement = void 0;

    // warning(
    //   // parse mask to test against actual mask prop as this.maskOptions
    //   // will be updated later in componentDidUpdate
    //   !restProps.maxLength || !parseMask(mask, maskChar, formatChars).mask,
    //   'react-input-mask: maxLength property shouldn\'t be passed to the masked input. It breaks masking and unnecessary because length is limited by the mask length.'
    // );

    if (children) {
      !isFunction(children) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'react-input-mask: children must be a function') : invariant(false) : void 0;

      var controlledProps = ['onChange', 'onPaste', 'onMouseDown', 'onFocus', 'onBlur', 'value', 'disabled', 'readOnly'];
      var childrenProps = _extends({}, restProps);
      controlledProps.forEach(function (propId) {
        return delete childrenProps[propId];
      });

      inputElement = children(childrenProps);

      var conflictProps = controlledProps.filter(function (propId) {
        return inputElement.props[propId] != null && inputElement.props[propId] !== restProps[propId];
      });

      !!conflictProps.length ? process.env.NODE_ENV !== 'production' ? invariant(false, 'react-input-mask: the following props should be passed to the react-input-mask\'s component and should not be altered in children\'s function: ' + conflictProps.join(', ')) : invariant(false) : void 0;

      // warning(
      //   !inputRef,
      //   'react-input-mask: inputRef is ignored when children is passed, attach ref to the children instead'
      // );
    } else {
      inputElement = React.createElement('input', _extends({ ref: this.handleRef }, restProps));
    }

    var changedProps = {
      onFocus: this.onFocus,
      onBlur: this.onBlur
    };

    if (this.maskOptions.mask) {
      if (!restProps.disabled && !restProps.readOnly) {
        changedProps.onChange = this.onChange;
        changedProps.onPaste = this.onPaste;
        changedProps.onMouseDown = this.onMouseDown;
      }

      if (restProps.value != null) {
        changedProps.value = this.value;
      }
    }

    inputElement = React.cloneElement(inputElement, changedProps);

    return inputElement;
  };

  return InputElement;
}(React.Component);

var _initialiseProps = function _initialiseProps() {
  var _this2 = this;

  this.focused = false;
  this.mounted = false;
  this.previousSelection = null;
  this.selectionDeferId = null;
  this.saveSelectionLoopDeferId = null;

  this.saveSelectionLoop = function () {
    _this2.previousSelection = _this2.getSelection();
    _this2.saveSelectionLoopDeferId = defer(_this2.saveSelectionLoop);
  };

  this.runSaveSelectionLoop = function () {
    if (_this2.saveSelectionLoopDeferId === null) {
      _this2.saveSelectionLoop();
    }
  };

  this.stopSaveSelectionLoop = function () {
    if (_this2.saveSelectionLoopDeferId !== null) {
      cancelDefer(_this2.saveSelectionLoopDeferId);
      _this2.saveSelectionLoopDeferId = null;
      _this2.previousSelection = null;
    }
  };

  this.getInputDOMNode = function () {
    if (!_this2.mounted) {
      return null;
    }

    var input = reactDom.findDOMNode(_this2);
    var isDOMNode = typeof window !== 'undefined' && input instanceof window.HTMLElement;

    // workaround for react-test-renderer
    // https://github.com/sanniassin/react-input-mask/issues/147
    if (input && !isDOMNode) {
      return null;
    }

    if (input.nodeName !== 'INPUT') {
      input = input.querySelector('input');
    }

    if (!input) {
      throw new Error('react-input-mask: inputComponent doesn\'t contain input node');
    }

    return input;
  };

  this.getInputValue = function () {
    var input = _this2.getInputDOMNode();
    if (!input) {
      return null;
    }

    return input.value;
  };

  this.setInputValue = function (value) {
    var input = _this2.getInputDOMNode();
    if (!input) {
      return;
    }

    _this2.value = value;
    input.value = value;
  };

  this.setCursorToEnd = function () {
    var filledLength = getFilledLength(_this2.maskOptions, _this2.value);
    var pos = getRightEditablePosition(_this2.maskOptions, filledLength);
    if (pos !== null) {
      _this2.setCursorPosition(pos);
    }
  };

  this.setSelection = function (start, end) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    var input = _this2.getInputDOMNode();
    var isFocused = _this2.isFocused();
    if (!input || !isFocused) {
      return;
    }

    var deferred = options.deferred;

    if (!deferred) {
      setInputSelection(input, start, end);
    }

    if (_this2.selectionDeferId !== null) {
      cancelDefer(_this2.selectionDeferId);
    }

    // deferred selection update is required for pre-Lollipop Android browser,
    // but for consistent behavior we do it for all browsers
    _this2.selectionDeferId = defer(function () {
      _this2.selectionDeferId = null;
      setInputSelection(input, start, end);
    });

    _this2.previousSelection = {
      start: start,
      end: end,
      length: Math.abs(end - start)
    };
  };

  this.getSelection = function () {
    var input = _this2.getInputDOMNode();

    return getInputSelection(input);
  };

  this.getCursorPosition = function () {
    return _this2.getSelection().start;
  };

  this.setCursorPosition = function (pos) {
    _this2.setSelection(pos, pos);
  };

  this.isFocused = function () {
    return _this2.focused;
  };

  this.getBeforeMaskedValueChangeConfig = function () {
    var _maskOptions = _this2.maskOptions,
        mask = _maskOptions.mask,
        maskChar = _maskOptions.maskChar,
        permanents = _maskOptions.permanents,
        formatChars = _maskOptions.formatChars;
    var alwaysShowMask = _this2.props.alwaysShowMask;

    return {
      mask: mask,
      maskChar: maskChar,
      permanents: permanents,
      alwaysShowMask: !!alwaysShowMask,
      formatChars: formatChars
    };
  };

  this.isInputAutofilled = function (value, selection, previousValue, previousSelection) {
    var input = _this2.getInputDOMNode();

    // only check for positive match because it will be false negative
    // in case of autofill simulation in tests
    //
    // input.matches throws an exception if selector isn't supported
    try {
      if (input.matches(':-webkit-autofill')) {
        return true;
      }
    } catch (e) {}

    // if input isn't focused then change event must have been triggered
    // either by autofill or event simulation in tests
    if (!_this2.focused) {
      return true;
    }

    // if cursor has moved to the end while previousSelection forbids it
    // then it must be autofill
    return previousSelection.end < previousValue.length && selection.end === value.length;
  };

  this.onChange = function (event) {
    var beforePasteState = _this2.beforePasteState;
    var previousSelection = _this2.previousSelection;
    var beforeMaskedValueChange = _this2.props.beforeMaskedValueChange;

    var value = _this2.getInputValue();
    var previousValue = _this2.value;
    var selection = _this2.getSelection();

    // autofill replaces entire value, ignore old one
    // https://github.com/sanniassin/react-input-mask/issues/113
    if (_this2.isInputAutofilled(value, selection, previousValue, previousSelection)) {
      previousValue = formatValue(_this2.maskOptions, '');
      previousSelection = { start: 0, end: 0, length: 0 };
    }

    // set value and selection as if we haven't
    // cleared input in onPaste handler
    if (beforePasteState) {
      previousSelection = beforePasteState.selection;
      previousValue = beforePasteState.value;
      selection = {
        start: previousSelection.start + value.length,
        end: previousSelection.start + value.length,
        length: 0
      };
      value = previousValue.slice(0, previousSelection.start) + value + previousValue.slice(previousSelection.end);
      _this2.beforePasteState = null;
    }

    var changedState = processChange(_this2.maskOptions, value, selection, previousValue, previousSelection);
    var enteredString = changedState.enteredString;
    var newSelection = changedState.selection;
    var newValue = changedState.value;

    if (isFunction(beforeMaskedValueChange)) {
      var modifiedValue = beforeMaskedValueChange({ value: newValue, selection: newSelection }, { value: previousValue, selection: previousSelection }, enteredString, _this2.getBeforeMaskedValueChangeConfig());
      newValue = modifiedValue.value;
      newSelection = modifiedValue.selection;
    }

    _this2.setInputValue(newValue);

    if (isFunction(_this2.props.onChange)) {
      _this2.props.onChange(event);
    }

    if (_this2.isWindowsPhoneBrowser) {
      _this2.setSelection(newSelection.start, newSelection.end, { deferred: true });
    } else {
      _this2.setSelection(newSelection.start, newSelection.end);
    }
  };

  this.onFocus = function (event) {
    var beforeMaskedValueChange = _this2.props.beforeMaskedValueChange;
    var _maskOptions2 = _this2.maskOptions,
        mask = _maskOptions2.mask,
        prefix = _maskOptions2.prefix;

    _this2.focused = true;

    // if autoFocus is set, onFocus triggers before componentDidMount
    _this2.mounted = true;

    if (mask) {
      if (!_this2.value) {
        var emptyValue = formatValue(_this2.maskOptions, prefix);
        var newValue = formatValue(_this2.maskOptions, emptyValue);
        var filledLength = getFilledLength(_this2.maskOptions, newValue);
        var cursorPosition = getRightEditablePosition(_this2.maskOptions, filledLength);
        var newSelection = { start: cursorPosition, end: cursorPosition };

        if (isFunction(beforeMaskedValueChange)) {
          var modifiedValue = beforeMaskedValueChange({ value: newValue, selection: newSelection }, { value: _this2.value, selection: null }, null, _this2.getBeforeMaskedValueChangeConfig());
          newValue = modifiedValue.value;
          newSelection = modifiedValue.selection;
        }

        var isInputValueChanged = newValue !== _this2.getInputValue();

        if (isInputValueChanged) {
          _this2.setInputValue(newValue);
        }

        if (isInputValueChanged && isFunction(_this2.props.onChange)) {
          _this2.props.onChange(event);
        }

        _this2.setSelection(newSelection.start, newSelection.end);
      } else if (getFilledLength(_this2.maskOptions, _this2.value) < _this2.maskOptions.mask.length) {
        _this2.setCursorToEnd();
      }

      _this2.runSaveSelectionLoop();
    }

    if (isFunction(_this2.props.onFocus)) {
      _this2.props.onFocus(event);
    }
  };

  this.onBlur = function (event) {
    var beforeMaskedValueChange = _this2.props.beforeMaskedValueChange;
    var mask = _this2.maskOptions.mask;

    _this2.stopSaveSelectionLoop();
    _this2.focused = false;

    if (mask && !_this2.props.alwaysShowMask && isEmpty(_this2.maskOptions, _this2.value)) {
      var newValue = '';

      if (isFunction(beforeMaskedValueChange)) {
        var modifiedValue = beforeMaskedValueChange({ value: newValue, selection: null }, { value: _this2.value, selection: _this2.previousSelection }, null, _this2.getBeforeMaskedValueChangeConfig());
        newValue = modifiedValue.value;
      }

      var isInputValueChanged = newValue !== _this2.getInputValue();

      if (isInputValueChanged) {
        _this2.setInputValue(newValue);
      }

      if (isInputValueChanged && isFunction(_this2.props.onChange)) {
        _this2.props.onChange(event);
      }
    }

    if (isFunction(_this2.props.onBlur)) {
      _this2.props.onBlur(event);
    }
  };

  this.onMouseDown = function (event) {
    // tiny unintentional mouse movements can break cursor
    // position on focus, so we have to restore it in that case
    //
    // https://github.com/sanniassin/react-input-mask/issues/108
    if (!_this2.focused && document.addEventListener) {
      _this2.mouseDownX = event.clientX;
      _this2.mouseDownY = event.clientY;
      _this2.mouseDownTime = new Date().getTime();

      var mouseUpHandler = function mouseUpHandler(mouseUpEvent) {
        document.removeEventListener('mouseup', mouseUpHandler);

        if (!_this2.focused) {
          return;
        }

        var deltaX = Math.abs(mouseUpEvent.clientX - _this2.mouseDownX);
        var deltaY = Math.abs(mouseUpEvent.clientY - _this2.mouseDownY);
        var axisDelta = Math.max(deltaX, deltaY);
        var timeDelta = new Date().getTime() - _this2.mouseDownTime;

        if (axisDelta <= 10 && timeDelta <= 200 || axisDelta <= 5 && timeDelta <= 300) {
          _this2.setCursorToEnd();
        }
      };

      document.addEventListener('mouseup', mouseUpHandler);
    }

    if (isFunction(_this2.props.onMouseDown)) {
      _this2.props.onMouseDown(event);
    }
  };

  this.onPaste = function (event) {
    if (isFunction(_this2.props.onPaste)) {
      _this2.props.onPaste(event);
    }

    // event.clipboardData might not work in Android browser
    // cleaning input to get raw text inside onChange handler
    if (!event.defaultPrevented) {
      _this2.beforePasteState = {
        value: _this2.getInputValue(),
        selection: _this2.getSelection()
      };
      _this2.setInputValue('');
    }
  };

  this.handleRef = function (ref) {
    if (_this2.props.children == null && isFunction(_this2.props.inputRef)) {
      _this2.props.inputRef(ref);
    }
  };
};

module.exports = InputElement;
