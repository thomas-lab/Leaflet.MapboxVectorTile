(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/index.js":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","ieee754":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","is-array":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js":[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js":[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/index.js":[function(require,module,exports){
(function (Buffer){
'use strict';

var ieee754 = require('ieee754');

module.exports = Protobuf;
function Protobuf(buf) {
    this.buf = buf;
    this.pos = 0;
}

Protobuf.prototype = {
    get length() { return this.buf.length; }
};

Protobuf.Varint = 0;
Protobuf.Int64 = 1;
Protobuf.Message = 2;
Protobuf.String = 2;
Protobuf.Packed = 2;
Protobuf.Int32 = 5;

Protobuf.prototype.destroy = function() {
    this.buf = null;
};

// === READING =================================================================

Protobuf.prototype.readUInt32 = function() {
    var val = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return val;
};

Protobuf.prototype.readUInt64 = function() {
    var val = this.buf.readUInt64LE(this.pos);
    this.pos += 8;
    return val;
};

Protobuf.prototype.readDouble = function() {
    var val = ieee754.read(this.buf, this.pos, true, 52, 8);
    this.pos += 8;
    return val;
};

Protobuf.prototype.readVarint = function() {
    // TODO: bounds checking
    var pos = this.pos;
    if (this.buf[pos] <= 0x7f) {
        this.pos++;
        return this.buf[pos];
    } else if (this.buf[pos + 1] <= 0x7f) {
        this.pos += 2;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] << 7);
    } else if (this.buf[pos + 2] <= 0x7f) {
        this.pos += 3;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2]) << 14;
    } else if (this.buf[pos + 3] <= 0x7f) {
        this.pos += 4;
        return (this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2] & 0x7f) << 14 | (this.buf[pos + 3]) << 21;
    } else if (this.buf[pos + 4] <= 0x7f) {
        this.pos += 5;
        return ((this.buf[pos] & 0x7f) | (this.buf[pos + 1] & 0x7f) << 7 | (this.buf[pos + 2] & 0x7f) << 14 | (this.buf[pos + 3]) << 21) + (this.buf[pos + 4] * 268435456);
    } else {
        this.skip(Protobuf.Varint);
        return 0;
        // throw new Error("TODO: Handle 6+ byte varints");
    }
};

Protobuf.prototype.readSVarint = function() {
    var num = this.readVarint();
    if (num > 2147483647) throw new Error('TODO: Handle numbers >= 2^30');
    // zigzag encoding
    return ((num >> 1) ^ -(num & 1));
};

Protobuf.prototype.readString = function() {
    var bytes = this.readVarint();
    // TODO: bounds checking
    var chr = String.fromCharCode;
    var b = this.buf;
    var p = this.pos;
    var end = this.pos + bytes;
    var str = '';
    while (p < end) {
        if (b[p] <= 0x7F) str += chr(b[p++]);
        else if (b[p] <= 0xBF) throw new Error('Invalid UTF-8 codepoint: ' + b[p]);
        else if (b[p] <= 0xDF) str += chr((b[p++] & 0x1F) << 6 | (b[p++] & 0x3F));
        else if (b[p] <= 0xEF) str += chr((b[p++] & 0x1F) << 12 | (b[p++] & 0x3F) << 6 | (b[p++] & 0x3F));
        else if (b[p] <= 0xF7) p += 4; // We can't handle these codepoints in JS, so skip.
        else if (b[p] <= 0xFB) p += 5;
        else if (b[p] <= 0xFD) p += 6;
        else throw new Error('Invalid UTF-8 codepoint: ' + b[p]);
    }
    this.pos += bytes;
    return str;
};

Protobuf.prototype.readBuffer = function() {
    var bytes = this.readVarint();
    var buffer = this.buf.subarray(this.pos, this.pos + bytes);
    this.pos += bytes;
    return buffer;
};

Protobuf.prototype.readPacked = function(type) {
    // TODO: bounds checking
    var bytes = this.readVarint();
    var end = this.pos + bytes;
    var array = [];
    while (this.pos < end) {
        array.push(this['read' + type]());
    }
    return array;
};

Protobuf.prototype.skip = function(val) {
    // TODO: bounds checking
    var type = val & 0x7;
    switch (type) {
        /* varint */ case Protobuf.Varint: while (this.buf[this.pos++] > 0x7f); break;
        /* 64 bit */ case Protobuf.Int64: this.pos += 8; break;
        /* length */ case Protobuf.Message: var bytes = this.readVarint(); this.pos += bytes; break;
        /* 32 bit */ case Protobuf.Int32: this.pos += 4; break;
        default: throw new Error('Unimplemented type: ' + type);
    }
};

// === WRITING =================================================================

Protobuf.prototype.writeTag = function(tag, type) {
    this.writeVarint((tag << 3) | type);
};

Protobuf.prototype.realloc = function(min) {
    var length = this.buf.length;
    while (length < this.pos + min) length *= 2;
    if (length != this.buf.length) {
        var buf = new Buffer(length);
        this.buf.copy(buf);
        this.buf = buf;
    }
};

Protobuf.prototype.finish = function() {
    return this.buf.slice(0, this.pos);
};

Protobuf.prototype.writePacked = function(type, tag, items) {
    if (!items.length) return;

    var message = new Protobuf();
    for (var i = 0; i < items.length; i++) {
        message['write' + type](items[i]);
    }
    var data = message.finish();

    this.writeTag(tag, Protobuf.Packed);
    this.writeBuffer(data);
};

Protobuf.prototype.writeUInt32 = function(val) {
    this.realloc(4);
    this.buf.writeUInt32LE(val, this.pos);
    this.pos += 4;
};

Protobuf.prototype.writeTaggedUInt32 = function(tag, val) {
    this.writeTag(tag, Protobuf.Int32);
    this.writeUInt32(val);
};

Protobuf.prototype.writeVarint = function(val) {
    val = Number(val);
    if (isNaN(val)) {
        val = 0;
    }

    if (val <= 0x7f) {
        this.realloc(1);
        this.buf[this.pos++] = val;
    } else if (val <= 0x3fff) {
        this.realloc(2);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 7) & 0x7f);
    } else if (val <= 0x1ffffff) {
        this.realloc(3);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 7) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 14) & 0x7f);
    } else if (val <= 0xfffffff) {
        this.realloc(4);
        this.buf[this.pos++] = 0x80 | ((val >>> 0) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 7) & 0x7f);
        this.buf[this.pos++] = 0x80 | ((val >>> 14) & 0x7f);
        this.buf[this.pos++] = 0x00 | ((val >>> 21) & 0x7f);
    } else {
        while (val > 0) {
            var b = val & 0x7f;
            val = Math.floor(val / 128);
            if (val > 0) b |= 0x80
            this.realloc(1);
            this.buf[this.pos++] = b;
        }
    }
};

Protobuf.prototype.writeTaggedVarint = function(tag, val) {
    this.writeTag(tag, Protobuf.Varint);
    this.writeVarint(val);
};

Protobuf.prototype.writeSVarint = function(val) {
    if (val >= 0) {
        this.writeVarint(val * 2);
    } else {
        this.writeVarint(val * -2 - 1);
    }
};

Protobuf.prototype.writeTaggedSVarint = function(tag, val) {
    this.writeTag(tag, Protobuf.Varint);
    this.writeSVarint(val);
};

Protobuf.prototype.writeBoolean = function(val) {
    this.writeVarint(Boolean(val));
};

Protobuf.prototype.writeTaggedBoolean = function(tag, val) {
    this.writeTaggedVarint(tag, Boolean(val));
};

Protobuf.prototype.writeString = function(str) {
    str = String(str);
    var bytes = Buffer.byteLength(str);
    this.writeVarint(bytes);
    this.realloc(bytes);
    this.buf.write(str, this.pos);
    this.pos += bytes;
};

Protobuf.prototype.writeTaggedString = function(tag, str) {
    this.writeTag(tag, Protobuf.String);
    this.writeString(str);
};

Protobuf.prototype.writeFloat = function(val) {
    this.realloc(4);
    this.buf.writeFloatLE(val, this.pos);
    this.pos += 4;
};

Protobuf.prototype.writeTaggedFloat = function(tag, val) {
    this.writeTag(tag, Protobuf.Int32);
    this.writeFloat(val);
};

Protobuf.prototype.writeDouble = function(val) {
    this.realloc(8);
    this.buf.writeDoubleLE(val, this.pos);
    this.pos += 8;
};

Protobuf.prototype.writeTaggedDouble = function(tag, val) {
    this.writeTag(tag, Protobuf.Int64);
    this.writeDouble(val);
};

Protobuf.prototype.writeBuffer = function(buffer) {
    var bytes = buffer.length;
    this.writeVarint(bytes);
    this.realloc(bytes);
    buffer.copy(this.buf, this.pos);
    this.pos += bytes;
};

Protobuf.prototype.writeTaggedBuffer = function(tag, buffer) {
    this.writeTag(tag, Protobuf.String);
    this.writeBuffer(buffer);
};

Protobuf.prototype.writeMessage = function(tag, protobuf) {
    var buffer = protobuf.finish();
    this.writeTag(tag, Protobuf.Message);
    this.writeBuffer(buffer);
};

}).call(this,require("buffer").Buffer)
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9wYmYvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3RvYnVmO1xuZnVuY3Rpb24gUHJvdG9idWYoYnVmKSB7XG4gICAgdGhpcy5idWYgPSBidWY7XG4gICAgdGhpcy5wb3MgPSAwO1xufVxuXG5Qcm90b2J1Zi5wcm90b3R5cGUgPSB7XG4gICAgZ2V0IGxlbmd0aCgpIHsgcmV0dXJuIHRoaXMuYnVmLmxlbmd0aDsgfVxufTtcblxuUHJvdG9idWYuVmFyaW50ID0gMDtcblByb3RvYnVmLkludDY0ID0gMTtcblByb3RvYnVmLk1lc3NhZ2UgPSAyO1xuUHJvdG9idWYuU3RyaW5nID0gMjtcblByb3RvYnVmLlBhY2tlZCA9IDI7XG5Qcm90b2J1Zi5JbnQzMiA9IDU7XG5cblByb3RvYnVmLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5idWYgPSBudWxsO1xufTtcblxuLy8gPT09IFJFQURJTkcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRVSW50MzIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmFsID0gdGhpcy5idWYucmVhZFVJbnQzMkxFKHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSA0O1xuICAgIHJldHVybiB2YWw7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFVJbnQ2NCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2YWwgPSB0aGlzLmJ1Zi5yZWFkVUludDY0TEUodGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDg7XG4gICAgcmV0dXJuIHZhbDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkRG91YmxlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZhbCA9IGllZWU3NTQucmVhZCh0aGlzLmJ1ZiwgdGhpcy5wb3MsIHRydWUsIDUyLCA4KTtcbiAgICB0aGlzLnBvcyArPSA4O1xuICAgIHJldHVybiB2YWw7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFZhcmludCA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciBwb3MgPSB0aGlzLnBvcztcbiAgICBpZiAodGhpcy5idWZbcG9zXSA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucG9zKys7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1Zltwb3NdO1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgMV0gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSAyO1xuICAgICAgICByZXR1cm4gKHRoaXMuYnVmW3Bvc10gJiAweDdmKSB8ICh0aGlzLmJ1Zltwb3MgKyAxXSA8PCA3KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDJdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gMztcbiAgICAgICAgcmV0dXJuICh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdKSA8PCAxNDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDNdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gNDtcbiAgICAgICAgcmV0dXJuICh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdICYgMHg3ZikgPDwgMTQgfCAodGhpcy5idWZbcG9zICsgM10pIDw8IDIxO1xuICAgIH0gZWxzZSBpZiAodGhpcy5idWZbcG9zICsgNF0gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcyArPSA1O1xuICAgICAgICByZXR1cm4gKCh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gJiAweDdmKSA8PCA3IHwgKHRoaXMuYnVmW3BvcyArIDJdICYgMHg3ZikgPDwgMTQgfCAodGhpcy5idWZbcG9zICsgM10pIDw8IDIxKSArICh0aGlzLmJ1Zltwb3MgKyA0XSAqIDI2ODQzNTQ1Nik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5za2lwKFByb3RvYnVmLlZhcmludCk7XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgICAvLyB0aHJvdyBuZXcgRXJyb3IoXCJUT0RPOiBIYW5kbGUgNisgYnl0ZSB2YXJpbnRzXCIpO1xuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkU1ZhcmludCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBudW0gPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICBpZiAobnVtID4gMjE0NzQ4MzY0NykgdGhyb3cgbmV3IEVycm9yKCdUT0RPOiBIYW5kbGUgbnVtYmVycyA+PSAyXjMwJyk7XG4gICAgLy8gemlnemFnIGVuY29kaW5nXG4gICAgcmV0dXJuICgobnVtID4+IDEpIF4gLShudW0gJiAxKSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFN0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMucmVhZFZhcmludCgpO1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciBjaHIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlO1xuICAgIHZhciBiID0gdGhpcy5idWY7XG4gICAgdmFyIHAgPSB0aGlzLnBvcztcbiAgICB2YXIgZW5kID0gdGhpcy5wb3MgKyBieXRlcztcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgd2hpbGUgKHAgPCBlbmQpIHtcbiAgICAgICAgaWYgKGJbcF0gPD0gMHg3Rikgc3RyICs9IGNocihiW3ArK10pO1xuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4QkYpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVVEYtOCBjb2RlcG9pbnQ6ICcgKyBiW3BdKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweERGKSBzdHIgKz0gY2hyKChiW3ArK10gJiAweDFGKSA8PCA2IHwgKGJbcCsrXSAmIDB4M0YpKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEVGKSBzdHIgKz0gY2hyKChiW3ArK10gJiAweDFGKSA8PCAxMiB8IChiW3ArK10gJiAweDNGKSA8PCA2IHwgKGJbcCsrXSAmIDB4M0YpKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEY3KSBwICs9IDQ7IC8vIFdlIGNhbid0IGhhbmRsZSB0aGVzZSBjb2RlcG9pbnRzIGluIEpTLCBzbyBza2lwLlxuICAgICAgICBlbHNlIGlmIChiW3BdIDw9IDB4RkIpIHAgKz0gNTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEZEKSBwICs9IDY7XG4gICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVURi04IGNvZGVwb2ludDogJyArIGJbcF0pO1xuICAgIH1cbiAgICB0aGlzLnBvcyArPSBieXRlcztcbiAgICByZXR1cm4gc3RyO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRCdWZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICB2YXIgYnVmZmVyID0gdGhpcy5idWYuc3ViYXJyYXkodGhpcy5wb3MsIHRoaXMucG9zICsgYnl0ZXMpO1xuICAgIHRoaXMucG9zICs9IGJ5dGVzO1xuICAgIHJldHVybiBidWZmZXI7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFBhY2tlZCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAvLyBUT0RPOiBib3VuZHMgY2hlY2tpbmdcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICB2YXIgZW5kID0gdGhpcy5wb3MgKyBieXRlcztcbiAgICB2YXIgYXJyYXkgPSBbXTtcbiAgICB3aGlsZSAodGhpcy5wb3MgPCBlbmQpIHtcbiAgICAgICAgYXJyYXkucHVzaCh0aGlzWydyZWFkJyArIHR5cGVdKCkpO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUuc2tpcCA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIC8vIFRPRE86IGJvdW5kcyBjaGVja2luZ1xuICAgIHZhciB0eXBlID0gdmFsICYgMHg3O1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAvKiB2YXJpbnQgKi8gY2FzZSBQcm90b2J1Zi5WYXJpbnQ6IHdoaWxlICh0aGlzLmJ1Zlt0aGlzLnBvcysrXSA+IDB4N2YpOyBicmVhaztcbiAgICAgICAgLyogNjQgYml0ICovIGNhc2UgUHJvdG9idWYuSW50NjQ6IHRoaXMucG9zICs9IDg7IGJyZWFrO1xuICAgICAgICAvKiBsZW5ndGggKi8gY2FzZSBQcm90b2J1Zi5NZXNzYWdlOiB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTsgdGhpcy5wb3MgKz0gYnl0ZXM7IGJyZWFrO1xuICAgICAgICAvKiAzMiBiaXQgKi8gY2FzZSBQcm90b2J1Zi5JbnQzMjogdGhpcy5wb3MgKz0gNDsgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcignVW5pbXBsZW1lbnRlZCB0eXBlOiAnICsgdHlwZSk7XG4gICAgfVxufTtcblxuLy8gPT09IFdSSVRJTkcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnID0gZnVuY3Rpb24odGFnLCB0eXBlKSB7XG4gICAgdGhpcy53cml0ZVZhcmludCgodGFnIDw8IDMpIHwgdHlwZSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhbGxvYyA9IGZ1bmN0aW9uKG1pbikge1xuICAgIHZhciBsZW5ndGggPSB0aGlzLmJ1Zi5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aCA8IHRoaXMucG9zICsgbWluKSBsZW5ndGggKj0gMjtcbiAgICBpZiAobGVuZ3RoICE9IHRoaXMuYnVmLmxlbmd0aCkge1xuICAgICAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpO1xuICAgICAgICB0aGlzLmJ1Zi5jb3B5KGJ1Zik7XG4gICAgICAgIHRoaXMuYnVmID0gYnVmO1xuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5maW5pc2ggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5idWYuc2xpY2UoMCwgdGhpcy5wb3MpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlUGFja2VkID0gZnVuY3Rpb24odHlwZSwgdGFnLCBpdGVtcykge1xuICAgIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XG5cbiAgICB2YXIgbWVzc2FnZSA9IG5ldyBQcm90b2J1ZigpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbWVzc2FnZVsnd3JpdGUnICsgdHlwZV0oaXRlbXNbaV0pO1xuICAgIH1cbiAgICB2YXIgZGF0YSA9IG1lc3NhZ2UuZmluaXNoKCk7XG5cbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuUGFja2VkKTtcbiAgICB0aGlzLndyaXRlQnVmZmVyKGRhdGEpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVUludDMyID0gZnVuY3Rpb24odmFsKSB7XG4gICAgdGhpcy5yZWFsbG9jKDQpO1xuICAgIHRoaXMuYnVmLndyaXRlVUludDMyTEUodmFsLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gNDtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFVJbnQzMiA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLkludDMyKTtcbiAgICB0aGlzLndyaXRlVUludDMyKHZhbCk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVWYXJpbnQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB2YWwgPSBOdW1iZXIodmFsKTtcbiAgICBpZiAoaXNOYU4odmFsKSkge1xuICAgICAgICB2YWwgPSAwO1xuICAgIH1cblxuICAgIGlmICh2YWwgPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoMSk7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gdmFsO1xuICAgIH0gZWxzZSBpZiAodmFsIDw9IDB4M2ZmZikge1xuICAgICAgICB0aGlzLnJlYWxsb2MoMik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAwKSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4MDAgfCAoKHZhbCA+Pj4gNykgJiAweDdmKTtcbiAgICB9IGVsc2UgaWYgKHZhbCA8PSAweDFmZmZmZmYpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDMpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDcpICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHgwMCB8ICgodmFsID4+PiAxNCkgJiAweDdmKTtcbiAgICB9IGVsc2UgaWYgKHZhbCA8PSAweGZmZmZmZmYpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDQpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDcpICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiAxNCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDAwIHwgKCh2YWwgPj4+IDIxKSAmIDB4N2YpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh2YWwgPiAwKSB7XG4gICAgICAgICAgICB2YXIgYiA9IHZhbCAmIDB4N2Y7XG4gICAgICAgICAgICB2YWwgPSBNYXRoLmZsb29yKHZhbCAvIDEyOCk7XG4gICAgICAgICAgICBpZiAodmFsID4gMCkgYiB8PSAweDgwXG4gICAgICAgICAgICB0aGlzLnJlYWxsb2MoMSk7XG4gICAgICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IGI7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRWYXJpbnQgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5WYXJpbnQpO1xuICAgIHRoaXMud3JpdGVWYXJpbnQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVNWYXJpbnQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICBpZiAodmFsID49IDApIHtcbiAgICAgICAgdGhpcy53cml0ZVZhcmludCh2YWwgKiAyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLndyaXRlVmFyaW50KHZhbCAqIC0yIC0gMSk7XG4gICAgfVxufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkU1ZhcmludCA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlZhcmludCk7XG4gICAgdGhpcy53cml0ZVNWYXJpbnQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZUJvb2xlYW4gPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLndyaXRlVmFyaW50KEJvb2xlYW4odmFsKSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRCb29sZWFuID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnZ2VkVmFyaW50KHRhZywgQm9vbGVhbih2YWwpKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVN0cmluZyA9IGZ1bmN0aW9uKHN0cikge1xuICAgIHN0ciA9IFN0cmluZyhzdHIpO1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN0cik7XG4gICAgdGhpcy53cml0ZVZhcmludChieXRlcyk7XG4gICAgdGhpcy5yZWFsbG9jKGJ5dGVzKTtcbiAgICB0aGlzLmJ1Zi53cml0ZShzdHIsIHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSBieXRlcztcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFN0cmluZyA9IGZ1bmN0aW9uKHRhZywgc3RyKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlN0cmluZyk7XG4gICAgdGhpcy53cml0ZVN0cmluZyhzdHIpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlRmxvYXQgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLnJlYWxsb2MoNCk7XG4gICAgdGhpcy5idWYud3JpdGVGbG9hdExFKHZhbCwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDQ7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRGbG9hdCA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLkludDMyKTtcbiAgICB0aGlzLndyaXRlRmxvYXQodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZURvdWJsZSA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIHRoaXMucmVhbGxvYyg4KTtcbiAgICB0aGlzLmJ1Zi53cml0ZURvdWJsZUxFKHZhbCwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDg7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWREb3VibGUgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5JbnQ2NCk7XG4gICAgdGhpcy53cml0ZURvdWJsZSh2YWwpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgdmFyIGJ5dGVzID0gYnVmZmVyLmxlbmd0aDtcbiAgICB0aGlzLndyaXRlVmFyaW50KGJ5dGVzKTtcbiAgICB0aGlzLnJlYWxsb2MoYnl0ZXMpO1xuICAgIGJ1ZmZlci5jb3B5KHRoaXMuYnVmLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gYnl0ZXM7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRCdWZmZXIgPSBmdW5jdGlvbih0YWcsIGJ1ZmZlcikge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5TdHJpbmcpO1xuICAgIHRoaXMud3JpdGVCdWZmZXIoYnVmZmVyKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZU1lc3NhZ2UgPSBmdW5jdGlvbih0YWcsIHByb3RvYnVmKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHByb3RvYnVmLmZpbmlzaCgpO1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5NZXNzYWdlKTtcbiAgICB0aGlzLndyaXRlQnVmZmVyKGJ1ZmZlcik7XG59O1xuIl19
},{"buffer":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/browserify/node_modules/buffer/index.js","ieee754":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/node_modules/ieee754/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js":[function(require,module,exports){
'use strict';

module.exports = Point;

function Point(x, y) {
    this.x = x;
    this.y = y;
}

Point.prototype = {
    clone: function() { return new Point(this.x, this.y); },

    add:     function(p) { return this.clone()._add(p);     },
    sub:     function(p) { return this.clone()._sub(p);     },
    mult:    function(k) { return this.clone()._mult(k);    },
    div:     function(k) { return this.clone()._div(k);     },
    rotate:  function(a) { return this.clone()._rotate(a);  },
    matMult: function(m) { return this.clone()._matMult(m); },
    unit:    function() { return this.clone()._unit(); },
    perp:    function() { return this.clone()._perp(); },
    round:   function() { return this.clone()._round(); },

    mag: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },

    equals: function(p) {
        return this.x === p.x &&
               this.y === p.y;
    },

    dist: function(p) {
        return Math.sqrt(this.distSqr(p));
    },

    distSqr: function(p) {
        var dx = p.x - this.x,
            dy = p.y - this.y;
        return dx * dx + dy * dy;
    },

    angle: function() {
        return Math.atan2(this.y, this.x);
    },

    angleTo: function(b) {
        return Math.atan2(this.y - b.y, this.x - b.x);
    },

    angleWith: function(b) {
        return this.angleWithSep(b.x, b.y);
    },

    // Find the angle of the two vectors, solving the formula for the cross product a x b = |a||b|sin(θ) for θ.
    angleWithSep: function(x, y) {
        return Math.atan2(
            this.x * y - this.y * x,
            this.x * x + this.y * y);
    },

    _matMult: function(m) {
        var x = m[0] * this.x + m[1] * this.y,
            y = m[2] * this.x + m[3] * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _add: function(p) {
        this.x += p.x;
        this.y += p.y;
        return this;
    },

    _sub: function(p) {
        this.x -= p.x;
        this.y -= p.y;
        return this;
    },

    _mult: function(k) {
        this.x *= k;
        this.y *= k;
        return this;
    },

    _div: function(k) {
        this.x /= k;
        this.y /= k;
        return this;
    },

    _unit: function() {
        this._div(this.mag());
        return this;
    },

    _perp: function() {
        var y = this.y;
        this.y = this.x;
        this.x = -y;
        return this;
    },

    _rotate: function(angle) {
        var cos = Math.cos(angle),
            sin = Math.sin(angle),
            x = cos * this.x - sin * this.y,
            y = sin * this.x + cos * this.y;
        this.x = x;
        this.y = y;
        return this;
    },

    _round: function() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }
};

// constructs Point from an array if necessary
Point.convert = function (a) {
    if (a instanceof Point) {
        return a;
    }
    if (Array.isArray(a)) {
        return new Point(a[0], a[1]);
    }
    return a;
};

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/rbush/rbush.js":[function(require,module,exports){
/*
 (c) 2015, Vladimir Agafonkin
 RBush, a JavaScript library for high-performance 2D spatial indexing of points and rectangles.
 https://github.com/mourner/rbush
*/

(function () { 'use strict';

function rbush(maxEntries, format) {

    // jshint newcap: false, validthis: true
    if (!(this instanceof rbush)) return new rbush(maxEntries, format);

    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries || 9);
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));

    if (format) {
        this._initFormat(format);
    }

    this.clear();
}

rbush.prototype = {

    all: function () {
        return this._all(this.data, []);
    },

    search: function (bbox) {

        var node = this.data,
            result = [],
            toBBox = this.toBBox;

        if (!intersects(bbox, node.bbox)) return result;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child.bbox;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf) result.push(child);
                    else if (contains(bbox, childBBox)) this._all(child, result);
                    else nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return result;
    },

    collides: function (bbox) {

        var node = this.data,
            toBBox = this.toBBox;

        if (!intersects(bbox, node.bbox)) return false;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child.bbox;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf || contains(bbox, childBBox)) return true;
                    nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return false;
    },

    load: function (data) {
        if (!(data && data.length)) return this;

        if (data.length < this._minEntries) {
            for (var i = 0, len = data.length; i < len; i++) {
                this.insert(data[i]);
            }
            return this;
        }

        // recursively build the tree with the given data from stratch using OMT algorithm
        var node = this._build(data.slice(), 0, data.length - 1, 0);

        if (!this.data.children.length) {
            // save as is if tree is empty
            this.data = node;

        } else if (this.data.height === node.height) {
            // split root if trees have the same height
            this._splitRoot(this.data, node);

        } else {
            if (this.data.height < node.height) {
                // swap trees if inserted one is bigger
                var tmpNode = this.data;
                this.data = node;
                node = tmpNode;
            }

            // insert the small tree into the large tree at appropriate level
            this._insert(node, this.data.height - node.height - 1, true);
        }

        return this;
    },

    insert: function (item) {
        if (item) this._insert(item, this.data.height - 1);
        return this;
    },

    clear: function () {
        this.data = {
            children: [],
            height: 1,
            bbox: empty(),
            leaf: true
        };
        return this;
    },

    remove: function (item) {
        if (!item) return this;

        var node = this.data,
            bbox = this.toBBox(item),
            path = [],
            indexes = [],
            i, parent, index, goingUp;

        // depth-first iterative tree traversal
        while (node || path.length) {

            if (!node) { // go up
                node = path.pop();
                parent = path[path.length - 1];
                i = indexes.pop();
                goingUp = true;
            }

            if (node.leaf) { // check current node
                index = node.children.indexOf(item);

                if (index !== -1) {
                    // item found, remove the item and condense tree upwards
                    node.children.splice(index, 1);
                    path.push(node);
                    this._condense(path);
                    return this;
                }
            }

            if (!goingUp && !node.leaf && contains(node.bbox, bbox)) { // go down
                path.push(node);
                indexes.push(i);
                i = 0;
                parent = node;
                node = node.children[0];

            } else if (parent) { // go right
                i++;
                node = parent.children[i];
                goingUp = false;

            } else node = null; // nothing found
        }

        return this;
    },

    toBBox: function (item) { return item; },

    compareMinX: function (a, b) { return a[0] - b[0]; },
    compareMinY: function (a, b) { return a[1] - b[1]; },

    toJSON: function () { return this.data; },

    fromJSON: function (data) {
        this.data = data;
        return this;
    },

    _all: function (node, result) {
        var nodesToSearch = [];
        while (node) {
            if (node.leaf) result.push.apply(result, node.children);
            else nodesToSearch.push.apply(nodesToSearch, node.children);

            node = nodesToSearch.pop();
        }
        return result;
    },

    _build: function (items, left, right, height) {

        var N = right - left + 1,
            M = this._maxEntries,
            node;

        if (N <= M) {
            // reached leaf level; return leaf
            node = {
                children: items.slice(left, right + 1),
                height: 1,
                bbox: null,
                leaf: true
            };
            calcBBox(node, this.toBBox);
            return node;
        }

        if (!height) {
            // target height of the bulk-loaded tree
            height = Math.ceil(Math.log(N) / Math.log(M));

            // target number of root entries to maximize storage utilization
            M = Math.ceil(N / Math.pow(M, height - 1));
        }

        // TODO eliminate recursion?

        node = {
            children: [],
            height: height,
            bbox: null
        };

        // split the items into M mostly square tiles

        var N2 = Math.ceil(N / M),
            N1 = N2 * Math.ceil(Math.sqrt(M)),
            i, j, right2, right3;

        multiSelect(items, left, right, N1, this.compareMinX);

        for (i = left; i <= right; i += N1) {

            right2 = Math.min(i + N1 - 1, right);

            multiSelect(items, i, right2, N2, this.compareMinY);

            for (j = i; j <= right2; j += N2) {

                right3 = Math.min(j + N2 - 1, right2);

                // pack each entry recursively
                node.children.push(this._build(items, j, right3, height - 1));
            }
        }

        calcBBox(node, this.toBBox);

        return node;
    },

    _chooseSubtree: function (bbox, node, level, path) {

        var i, len, child, targetNode, area, enlargement, minArea, minEnlargement;

        while (true) {
            path.push(node);

            if (node.leaf || path.length - 1 === level) break;

            minArea = minEnlargement = Infinity;

            for (i = 0, len = node.children.length; i < len; i++) {
                child = node.children[i];
                area = bboxArea(child.bbox);
                enlargement = enlargedArea(bbox, child.bbox) - area;

                // choose entry with the least area enlargement
                if (enlargement < minEnlargement) {
                    minEnlargement = enlargement;
                    minArea = area < minArea ? area : minArea;
                    targetNode = child;

                } else if (enlargement === minEnlargement) {
                    // otherwise choose one with the smallest area
                    if (area < minArea) {
                        minArea = area;
                        targetNode = child;
                    }
                }
            }

            node = targetNode;
        }

        return node;
    },

    _insert: function (item, level, isNode) {

        var toBBox = this.toBBox,
            bbox = isNode ? item.bbox : toBBox(item),
            insertPath = [];

        // find the best node for accommodating the item, saving all nodes along the path too
        var node = this._chooseSubtree(bbox, this.data, level, insertPath);

        // put the item into the node
        node.children.push(item);
        extend(node.bbox, bbox);

        // split on node overflow; propagate upwards if necessary
        while (level >= 0) {
            if (insertPath[level].children.length > this._maxEntries) {
                this._split(insertPath, level);
                level--;
            } else break;
        }

        // adjust bboxes along the insertion path
        this._adjustParentBBoxes(bbox, insertPath, level);
    },

    // split overflowed node into two
    _split: function (insertPath, level) {

        var node = insertPath[level],
            M = node.children.length,
            m = this._minEntries;

        this._chooseSplitAxis(node, m, M);

        var splitIndex = this._chooseSplitIndex(node, m, M);

        var newNode = {
            children: node.children.splice(splitIndex, node.children.length - splitIndex),
            height: node.height
        };

        if (node.leaf) newNode.leaf = true;

        calcBBox(node, this.toBBox);
        calcBBox(newNode, this.toBBox);

        if (level) insertPath[level - 1].children.push(newNode);
        else this._splitRoot(node, newNode);
    },

    _splitRoot: function (node, newNode) {
        // split root node
        this.data = {
            children: [node, newNode],
            height: node.height + 1
        };
        calcBBox(this.data, this.toBBox);
    },

    _chooseSplitIndex: function (node, m, M) {

        var i, bbox1, bbox2, overlap, area, minOverlap, minArea, index;

        minOverlap = minArea = Infinity;

        for (i = m; i <= M - m; i++) {
            bbox1 = distBBox(node, 0, i, this.toBBox);
            bbox2 = distBBox(node, i, M, this.toBBox);

            overlap = intersectionArea(bbox1, bbox2);
            area = bboxArea(bbox1) + bboxArea(bbox2);

            // choose distribution with minimum overlap
            if (overlap < minOverlap) {
                minOverlap = overlap;
                index = i;

                minArea = area < minArea ? area : minArea;

            } else if (overlap === minOverlap) {
                // otherwise choose distribution with minimum area
                if (area < minArea) {
                    minArea = area;
                    index = i;
                }
            }
        }

        return index;
    },

    // sorts node children by the best axis for split
    _chooseSplitAxis: function (node, m, M) {

        var compareMinX = node.leaf ? this.compareMinX : compareNodeMinX,
            compareMinY = node.leaf ? this.compareMinY : compareNodeMinY,
            xMargin = this._allDistMargin(node, m, M, compareMinX),
            yMargin = this._allDistMargin(node, m, M, compareMinY);

        // if total distributions margin value is minimal for x, sort by minX,
        // otherwise it's already sorted by minY
        if (xMargin < yMargin) node.children.sort(compareMinX);
    },

    // total margin of all possible split distributions where each node is at least m full
    _allDistMargin: function (node, m, M, compare) {

        node.children.sort(compare);

        var toBBox = this.toBBox,
            leftBBox = distBBox(node, 0, m, toBBox),
            rightBBox = distBBox(node, M - m, M, toBBox),
            margin = bboxMargin(leftBBox) + bboxMargin(rightBBox),
            i, child;

        for (i = m; i < M - m; i++) {
            child = node.children[i];
            extend(leftBBox, node.leaf ? toBBox(child) : child.bbox);
            margin += bboxMargin(leftBBox);
        }

        for (i = M - m - 1; i >= m; i--) {
            child = node.children[i];
            extend(rightBBox, node.leaf ? toBBox(child) : child.bbox);
            margin += bboxMargin(rightBBox);
        }

        return margin;
    },

    _adjustParentBBoxes: function (bbox, path, level) {
        // adjust bboxes along the given tree path
        for (var i = level; i >= 0; i--) {
            extend(path[i].bbox, bbox);
        }
    },

    _condense: function (path) {
        // go through the path, removing empty nodes and updating bboxes
        for (var i = path.length - 1, siblings; i >= 0; i--) {
            if (path[i].children.length === 0) {
                if (i > 0) {
                    siblings = path[i - 1].children;
                    siblings.splice(siblings.indexOf(path[i]), 1);

                } else this.clear();

            } else calcBBox(path[i], this.toBBox);
        }
    },

    _initFormat: function (format) {
        // data format (minX, minY, maxX, maxY accessors)

        // uses eval-type function compilation instead of just accepting a toBBox function
        // because the algorithms are very sensitive to sorting functions performance,
        // so they should be dead simple and without inner calls

        // jshint evil: true

        var compareArr = ['return a', ' - b', ';'];

        this.compareMinX = new Function('a', 'b', compareArr.join(format[0]));
        this.compareMinY = new Function('a', 'b', compareArr.join(format[1]));

        this.toBBox = new Function('a', 'return [a' + format.join(', a') + '];');
    }
};


// calculate node's bbox from bboxes of its children
function calcBBox(node, toBBox) {
    node.bbox = distBBox(node, 0, node.children.length, toBBox);
}

// min bounding rectangle of node children from k to p-1
function distBBox(node, k, p, toBBox) {
    var bbox = empty();

    for (var i = k, child; i < p; i++) {
        child = node.children[i];
        extend(bbox, node.leaf ? toBBox(child) : child.bbox);
    }

    return bbox;
}

function empty() { return [Infinity, Infinity, -Infinity, -Infinity]; }

function extend(a, b) {
    a[0] = Math.min(a[0], b[0]);
    a[1] = Math.min(a[1], b[1]);
    a[2] = Math.max(a[2], b[2]);
    a[3] = Math.max(a[3], b[3]);
    return a;
}

function compareNodeMinX(a, b) { return a.bbox[0] - b.bbox[0]; }
function compareNodeMinY(a, b) { return a.bbox[1] - b.bbox[1]; }

function bboxArea(a)   { return (a[2] - a[0]) * (a[3] - a[1]); }
function bboxMargin(a) { return (a[2] - a[0]) + (a[3] - a[1]); }

function enlargedArea(a, b) {
    return (Math.max(b[2], a[2]) - Math.min(b[0], a[0])) *
           (Math.max(b[3], a[3]) - Math.min(b[1], a[1]));
}

function intersectionArea(a, b) {
    var minX = Math.max(a[0], b[0]),
        minY = Math.max(a[1], b[1]),
        maxX = Math.min(a[2], b[2]),
        maxY = Math.min(a[3], b[3]);

    return Math.max(0, maxX - minX) *
           Math.max(0, maxY - minY);
}

function contains(a, b) {
    return a[0] <= b[0] &&
           a[1] <= b[1] &&
           b[2] <= a[2] &&
           b[3] <= a[3];
}

function intersects(a, b) {
    return b[0] <= a[2] &&
           b[1] <= a[3] &&
           b[2] >= a[0] &&
           b[3] >= a[1];
}

// sort an array so that items come in groups of n unsorted items, with groups sorted between each other;
// combines selection algorithm with binary divide & conquer approach

function multiSelect(arr, left, right, n, compare) {
    var stack = [left, right],
        mid;

    while (stack.length) {
        right = stack.pop();
        left = stack.pop();

        if (right - left <= n) continue;

        mid = left + Math.ceil((right - left) / n / 2) * n;
        select(arr, left, right, mid, compare);

        stack.push(left, mid, mid, right);
    }
}

// Floyd-Rivest selection algorithm:
// sort an array between left and right (inclusive) so that the smallest k elements come first (unordered)
function select(arr, left, right, k, compare) {
    var n, i, z, s, sd, newLeft, newRight, t, j;

    while (right > left) {
        if (right - left > 600) {
            n = right - left + 1;
            i = k - left + 1;
            z = Math.log(n);
            s = 0.5 * Math.exp(2 * z / 3);
            sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (i - n / 2 < 0 ? -1 : 1);
            newLeft = Math.max(left, Math.floor(k - i * s / n + sd));
            newRight = Math.min(right, Math.floor(k + (n - i) * s / n + sd));
            select(arr, newLeft, newRight, k, compare);
        }

        t = arr[k];
        i = left;
        j = right;

        swap(arr, left, k);
        if (compare(arr[right], t) > 0) swap(arr, left, right);

        while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (compare(arr[i], t) < 0) i++;
            while (compare(arr[j], t) > 0) j--;
        }

        if (compare(arr[left], t) === 0) swap(arr, left, j);
        else {
            j++;
            swap(arr, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}


// export as AMD/CommonJS module or global variable
if (typeof define === 'function' && define.amd) define('rbush', function() { return rbush; });
else if (typeof module !== 'undefined') module.exports = rbush;
else if (typeof self !== 'undefined') self.rbush = rbush;
else window.rbush = rbush;

})();

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/index.js":[function(require,module,exports){
module.exports.VectorTile = require('./lib/vectortile.js');
module.exports.VectorTileFeature = require('./lib/vectortilefeature.js');
module.exports.VectorTileLayer = require('./lib/vectortilelayer.js');

},{"./lib/vectortile.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortile.js","./lib/vectortilefeature.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js","./lib/vectortilelayer.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortile.js":[function(require,module,exports){
'use strict';

var VectorTileLayer = require('./vectortilelayer');

module.exports = VectorTile;

function VectorTile(buffer, end) {

    this.layers = {};
    this._buffer = buffer;

    end = end || buffer.length;

    while (buffer.pos < end) {
        var val = buffer.readVarint(),
            tag = val >> 3;

        if (tag == 3) {
            var layer = this.readLayer();
            if (layer.length) this.layers[layer.name] = layer;
        } else {
            buffer.skip(val);
        }
    }
}

VectorTile.prototype.readLayer = function() {
    var buffer = this._buffer,
        bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        layer = new VectorTileLayer(buffer, end);

    buffer.pos = end;

    return layer;
};

},{"./vectortilelayer":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js":[function(require,module,exports){
'use strict';

var Point = require('point-geometry');

module.exports = VectorTileFeature;

function VectorTileFeature(buffer, end, extent, keys, values) {

    this.properties = {};

    // Public
    this.extent = extent;
    this.type = 0;

    // Private
    this._buffer = buffer;
    this._geometry = -1;

    end = end || buffer.length;

    while (buffer.pos < end) {
        var val = buffer.readVarint(),
            tag = val >> 3;

        if (tag == 1) {
            this._id = buffer.readVarint();

        } else if (tag == 2) {
            var tagLen = buffer.readVarint(),
                tagEnd = buffer.pos + tagLen;

            while (buffer.pos < tagEnd) {
                var key = keys[buffer.readVarint()];
                var value = values[buffer.readVarint()];
                this.properties[key] = value;
            }

        } else if (tag == 3) {
            this.type = buffer.readVarint();

        } else if (tag == 4) {
            this._geometry = buffer.pos;
            buffer.skip(val);

        } else {
            buffer.skip(val);
        }
    }
}

VectorTileFeature.types = ['Unknown', 'Point', 'LineString', 'Polygon'];

VectorTileFeature.prototype.loadGeometry = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        lines = [],
        line;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();

            if (cmd === 1) {
                // moveTo
                if (line) {
                    lines.push(line);
                }
                line = [];
            }

            line.push(new Point(x, y));
        } else if (cmd === 7) {
            // closePolygon
            line.push(line[0].clone());
        } else {
            throw new Error('unknown command ' + cmd);
        }
    }

    if (line) lines.push(line);

    return lines;
};

VectorTileFeature.prototype.bbox = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint(),
        end = buffer.pos + bytes,

        cmd = 1,
        length = 0,
        x = 0,
        y = 0,
        x1 = Infinity,
        x2 = -Infinity,
        y1 = Infinity,
        y2 = -Infinity;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd === 1 || cmd === 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();
            if (x < x1) x1 = x;
            if (x > x2) x2 = x;
            if (y < y1) y1 = y;
            if (y > y2) y2 = y;

        } else if (cmd !== 7) {
            throw new Error('unknown command ' + cmd);
        }
    }

    return [x1, y1, x2, y2];
};

},{"point-geometry":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilelayer.js":[function(require,module,exports){
'use strict';

var VectorTileFeature = require('./vectortilefeature.js');

module.exports = VectorTileLayer;
function VectorTileLayer(buffer, end) {
    // Public
    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;

    // Private
    this._buffer = buffer;
    this._keys = [];
    this._values = [];
    this._features = [];

    var val, tag;

    end = end || buffer.length;

    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag === 15) {
            this.version = buffer.readVarint();
        } else if (tag === 1) {
            this.name = buffer.readString();
        } else if (tag === 5) {
            this.extent = buffer.readVarint();
        } else if (tag === 2) {
            this.length++;
            this._features.push(buffer.pos);
            buffer.skip(val);

        } else if (tag === 3) {
            this._keys.push(buffer.readString());
        } else if (tag === 4) {
            this._values.push(this.readFeatureValue());
        } else {
            buffer.skip(val);
        }
    }
}

VectorTileLayer.prototype.readFeatureValue = function() {
    var buffer = this._buffer,
        value = null,
        bytes = buffer.readVarint(),
        end = buffer.pos + bytes,
        val, tag;

    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            value = buffer.readString();
        } else if (tag == 2) {
            throw new Error('read float');
        } else if (tag == 3) {
            value = buffer.readDouble();
        } else if (tag == 4) {
            value = buffer.readVarint();
        } else if (tag == 5) {
            throw new Error('read uint');
        } else if (tag == 6) {
            value = buffer.readSVarint();
        } else if (tag == 7) {
            value = Boolean(buffer.readVarint());
        } else {
            buffer.skip(val);
        }
    }

    return value;
};

// return feature `i` from this layer as a `VectorTileFeature`
VectorTileLayer.prototype.feature = function(i) {
    if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');

    this._buffer.pos = this._features[i];
    var end = this._buffer.readVarint() + this._buffer.pos;

    return new VectorTileFeature(this._buffer, end, this.extent, this._keys, this._values);
};

},{"./vectortilefeature.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/lib/vectortilefeature.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTFeature.js":[function(require,module,exports){
/**
 * Created by Ryan Whitley, Daniel Duarte, and Nicholas Hallahan
 *    on 6/03/14.
 */
var Util = require('./MVTUtil');
var StaticLabel = require('./StaticLabel/StaticLabel.js');

module.exports = MVTFeature;

function MVTFeature(mvtLayer, vtf, ctx, id, style) {
  if (!vtf) return null;

  // Apply all of the properties of vtf to this object.
  for (var key in vtf) {
    // Ignore private fields.
    if (key.charAt(0) !== '_') {
      this[key] = vtf[key];
    }
  }

  this.mvtLayer = mvtLayer;
  this.mvtSource = mvtLayer.mvtSource;
  this.map = mvtLayer.mvtSource.map;

  this.id = id;

  this.layerLink = this.mvtSource.layerLink;
  this.toggleEnabled = true;
  this.selected = false;

  // how much we divide the coordinate from the vector tile
  this.divisor = vtf.extent / ctx.tileSize;
  this.extent = vtf.extent;
  this.tileSize = ctx.tileSize;

  //An object to store the paths and contexts for this feature
  this.tiles = {};

  // TODO: think about this design
  this.mvtLayer.imgCache = this.mvtLayer.imgCache || {};

  this.style = style;

  //Add to the collection
  this.addTileFeature(vtf, ctx);

  this.map.on('zoomend', this._zoomend, this);
  var self = this;
  mvtLayer.on('remove', function() {
    self.map.off('zoomend', self._zoomend, self);
  });

  if (style && style.dynamicLabel && typeof style.dynamicLabel === 'function') {
    this.dynamicLabel = this.mvtSource.dynamicLabel.createFeature(this);
  }

  ajax(this);
}


function ajax(self) {
  var style = self.style;
  if (style && style.ajaxSource && typeof style.ajaxSource === 'function') {
    var ajaxEndpoint = style.ajaxSource(self);
    if (ajaxEndpoint) {
      Util.getJSON(ajaxEndpoint, function(error, response, body) {
        if (error) {
          throw ['ajaxSource AJAX Error', error];
        } else {
          ajaxCallback(self, response);
          return true;
        }
      });
    }
  }
  return false;
}

function ajaxCallback(self, response) {
  self.ajaxData = response;

  /**
   * You can attach a callback function to a feature in your app
   * that will get called whenever new ajaxData comes in. This
   * can be used to update UI that looks at data from within a feature.
   *
   * setStyle may possibly have a style with a different ajaxData source,
   * and you would potentially get new contextual data for your feature.
   *
   * TODO: This needs to be documented.
   */
  if (typeof self.ajaxDataReceived === 'function') {
    self.ajaxDataReceived(self, response);
  }

  self._setStyle(self.mvtLayer.style);
  this.redraw();
}

MVTFeature.prototype._setStyle = function(styleFn) {
  this.style = styleFn(this, this.ajaxData);

  // The label gets removed, and the (re)draw,
  // that is initiated by the MVTLayer creates a new label.
  this.removeLabel();
};

MVTFeature.prototype.setStyle = function(styleFn) {
  this.ajaxData = null;
  this.style = styleFn(this, null);
  var hasAjaxSource = ajax(this);
  if (!hasAjaxSource) {
    // The label gets removed, and the (re)draw,
    // that is initiated by the MVTLayer creates a new label.
    this.removeLabel();
  }
};

MVTFeature.prototype.draw = function(canvasID) {
  //Get the info from the tiles list
  var tileInfo =  this.tiles[canvasID];

  var vtf = tileInfo.vtf;
  var ctx = tileInfo.ctx;

  //Get the actual canvas from the parent layer's _tiles object.
  var xy = canvasID.split(":").slice(1, 3).join(":");
  ctx.canvas = this.mvtLayer._tiles[xy];

//  This could be used to directly compute the style function from the layer on every draw.
//  This is much less efficient...
//  this.style = this.mvtLayer.style(this);

  if (this.selected) {
    var style = this.style.selected || this.style;
  } else {
    var style = this.style;
  }

  switch (vtf.type) {
    case 1: //Point
      this._drawPoint(ctx, vtf.coordinates, style);
      if (!this.staticLabel && typeof this.style.staticLabel === 'function') {
        if (this.style.ajaxSource && !this.ajaxData) {
          break;
        }
        this._drawStaticLabel(ctx, vtf.coordinates, style);
      }
      break;

    case 2: //LineString
      this._drawLineString(ctx, vtf.coordinates, style);
      break;

    case 3: //Polygon
      this._drawPolygon(ctx, vtf.coordinates, style);
      break;

    default:
      throw new Error('Unmanaged type: ' + vtf.type);
  }

};

MVTFeature.prototype.getPathsForTile = function(canvasID) {
  var tile = this.tiles[canvasID];
  if (tile) {
    return tile.paths;
  } else {
    return [];
  }
};

MVTFeature.prototype.addTileFeature = function(vtf, ctx) {
  //Store the important items in the tiles list

  //We only want to store info for tiles for the current map zoom.  If it is tile info for another zoom level, ignore it
  //Also, if there are existing tiles in the list for other zoom levels, expunge them.
  var zoom = this.map.getZoom();

  if(ctx.zoom != zoom) return;

  this.tiles[ctx.id] = {
    ctx: ctx,
    vtf: vtf,
    paths: []
  };

};


/**
 * Clear the inner list of tile features if they don't match the given zoom.
 *
 * @param zoom
 */
MVTFeature.prototype.clearTileFeatures = function(zoom) {
  //If stored tiles exist for other zoom levels, expunge them from the list.
  for (var key in this.tiles) {
     if(key.split(":")[0] != zoom) delete this.tiles[key];
  }
};

/**
 * Redraws all of the tiles associated with a feature. Useful for
 * style change and toggling.
 */
MVTFeature.prototype.redraw = function() {
  //Redraw the whole tile, not just this vtf
  for (var id in this.tiles) {
    var tileZoom = parseInt(id.split(':')[0]);
    var mapZoom = this.map.getZoom();
    if (tileZoom === mapZoom) {
      //Redraw the tile
      this.mvtLayer.redrawTile(id);
    }
  }
}

MVTFeature.prototype.toggle = function() {
  if (this.selected) {
    this.deselect();
  } else {
    this.select();
  }
};

MVTFeature.prototype.select = function() {
  this.selected = true;
  this.mvtSource.featureSelected(this);
  this.redraw();
  var linkedFeature = this.linkedFeature();
  if (linkedFeature && linkedFeature.staticLabel && !linkedFeature.staticLabel.selected) {
    linkedFeature.staticLabel.select();
  }
};

MVTFeature.prototype.deselect = function() {
  this.selected = false;
  this.mvtSource.featureDeselected(this);
  this.redraw();
  var linkedFeature = this.linkedFeature();
  if (linkedFeature && linkedFeature.staticLabel && linkedFeature.staticLabel.selected) {
    linkedFeature.staticLabel.deselect();
  }
};

MVTFeature.prototype.on = function(eventType, callback) {
  this._eventHandlers[eventType] = callback;
};

MVTFeature.prototype._drawPoint = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx || !ctx.canvas) return;

  var tile = this.tiles[ctx.id];

  var p = this._tilePoint(coordsArray[0][0]);
  var c = ctx.canvas;
  var ctx2d;

  try {
    ctx2d = c.getContext('2d');
  }
  catch(e) {
    console.log("_drawPoint error: " + e);
    return;
  }

  if ('iconUrl' in style){
    this._drawPointIcon(ctx, ctx2d, p, style); 
  } else {
    this._drawPointCircle(ctx, ctx2d, p, style);
  }

  tile.paths.push([p]);
};

MVTFeature.prototype._drawPointCircle = function(ctx, ctx2d, p, style) {

  //Get radius
  var radius = 1;
  if (typeof style.radius === 'function') {
    radius = style.radius(ctx.zoom); //Allows for scale dependent rednering
  }
  else{
    radius = style.radius;
  }

  ctx2d.beginPath();
  ctx2d.fillStyle = style.color;
  ctx2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx2d.closePath();
  ctx2d.fill();

  if(style.lineWidth && style.strokeStyle){
    ctx2d.lineWidth = style.lineWidth;
    ctx2d.strokeStyle = style.strokeStyle;
    ctx2d.stroke();
  }

  ctx2d.restore();
};

MVTFeature.prototype._drawPointIcon = function(ctx, ctx2d, p, style){

    var url = style.iconUrl;
    var img;
    if (!(url in this.mvtLayer.imgCache)){
        img = new Image();
        img.src = url;
        this.mvtLayer.imgCache[url] = img;
    } else {
        img = this.mvtLayer.imgCache[url];
    }

    //Get radius
    var radius = 1;
    if (typeof style.radius === 'function') {
      radius = style.radius(ctx.zoom); //Allows for scale dependent rednering
    }
    else {
      radius = style.radius;
    }

    if (img.complete){
        ctx2d.drawImage(img, p.x - radius, p.y - radius, radius*2, radius*2);
    } else {
        (function(x,y){
            $(img).load(function(){
                ctx2d.drawImage(this, x - radius, y - radius, radius*2, radius*2);
            });
        })(p.x, p.y);
    }
}

MVTFeature.prototype._drawLineString = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx || !ctx.canvas) return;

  var ctx2d = ctx.canvas.getContext('2d');
  ctx2d.strokeStyle = style.color;
  ctx2d.lineWidth = style.size;
  ctx2d.beginPath();

  var projCoords = [];
  var tile = this.tiles[ctx.id];

  for (var gidx in coordsArray) {
    var coords = coordsArray[gidx];

    for (i = 0; i < coords.length; i++) {
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      ctx2d[method](proj.x, proj.y);
    }
  }

  ctx2d.stroke();
  ctx2d.restore();

  tile.paths.push(projCoords);
};

MVTFeature.prototype._drawPolygon = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx || !ctx.canvas) return;
  console.log("MVTFeature: style is " + JSON.stringify(style));

  var ctx2d = ctx.canvas.getContext('2d');

  // Save and render feature w/ specified alpha
  var preAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = style.opacity || preAlpha;

  var outline = style.outline;

  // color may be defined via function to make choropleth work right
  if (typeof style.color === 'function') {
    ctx2d.fillStyle = style.color(ctx2d);
  } else {
    ctx2d.fillStyle = style.color;
  }

  if (outline) {
    ctx2d.strokeStyle = outline.color;
    ctx2d.lineWidth = outline.size;
  }
  ctx2d.beginPath();

  var projCoords = [];
  var tile = this.tiles[ctx.id];

  var featureLabel = this.dynamicLabel;
  if (featureLabel) {
    featureLabel.addTilePolys(ctx, coordsArray);
  }

  for (var gidx = 0, len = coordsArray.length; gidx < len; gidx++) {
    var coords = coordsArray[gidx];

    for (var i = 0; i < coords.length; i++) {
      var coord = coords[i];
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      ctx2d[method](proj.x, proj.y);
    }
  }

  ctx2d.closePath();
  ctx2d.fill();
  if (outline) {
    ctx2d.stroke();
  }

  tile.paths.push(projCoords);

  // Restore alpha
  ctx2d.globalAlpha = preAlpha;
};

MVTFeature.prototype._drawStaticLabel = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx) return;

  // If the corresponding layer is not on the map, 
  // we dont want to put on a label.
  if (!this.mvtLayer._map) return;

  var vecPt = this._tilePoint(coordsArray[0][0]);

  // We're making a standard Leaflet Marker for this label.
  var p = this._project(vecPt, ctx.tile.x, ctx.tile.y, this.extent, this.tileSize); //vectile pt to merc pt
  var mercPt = L.point(p.x, p.y); // make into leaflet obj
  var latLng = this.map.unproject(mercPt); // merc pt to latlng

  this.staticLabel = new StaticLabel(this, ctx, latLng, style);
  this.mvtLayer.featureWithLabelAdded(this);
};

MVTFeature.prototype.removeLabel = function() {
  if (!this.staticLabel) return;
  this.staticLabel.remove();
  this.staticLabel = null;
};

MVTFeature.prototype._zoomend = function() {
  this.removeLabel();
  this.clearTileFeatures(this.map.getZoom());
};

/**
 * Projects a vector tile point to the Spherical Mercator pixel space for a given zoom level.
 *
 * @param vecPt
 * @param tileX
 * @param tileY
 * @param extent
 * @param tileSize
 */
MVTFeature.prototype._project = function(vecPt, tileX, tileY, extent, tileSize) {
  var xOffset = tileX * tileSize;
  var yOffset = tileY * tileSize;
  return {
    x: Math.floor(vecPt.x + xOffset),
    y: Math.floor(vecPt.y + yOffset)
  };
};

/**
 * Takes a coordinate from a vector tile and turns it into a Leaflet Point.
 *
 * @param ctx
 * @param coords
 * @returns {eGeomType.Point}
 * @private
 */
MVTFeature.prototype._tilePoint = function(coords) {
  return new L.Point(coords.x / this.divisor, coords.y / this.divisor);
};

MVTFeature.prototype.linkedFeature = function() {
  var linkedLayer = this.mvtLayer.linkedLayer();
  if(linkedLayer){
    var linkedFeature = linkedLayer.features[this.id];
    return linkedFeature;
  }else{
    return null;
  }
};


},{"./MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js","./StaticLabel/StaticLabel.js":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/StaticLabel/StaticLabel.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTLayer.js":[function(require,module,exports){
/**
 * Created by Ryan Whitley on 5/17/14.
 */
/** Forked from https://gist.github.com/DGuidi/1716010 **/

var MVTFeature = require('./MVTFeature');

var Util = require('./MVTUtil');
var rbush = require('rbush');

module.exports = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    isHiddenLayer: false,
    getIDForLayerFeature: function() {},
    tileSize: 256,
    lineClickTolerance: 2,
    buffer: 5,
  },

  _featureIsClicked: {},

  _isPointInPoly: function(pt, poly) {
    if(poly && poly.length) {
      for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
        && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
        && (c = !c);
      return c;
    }
  },

  _getDistanceFromLine: function(pt, pts) {
    var min = Number.POSITIVE_INFINITY;
    if (pts && pts.length > 1) {
      pt = L.point(pt.x, pt.y);
      for (var i = 0, l = pts.length - 1; i < l; i++) {
        var test = this._projectPointOnLineSegment(pt, pts[i], pts[i + 1]);
        if (test.distance <= min) {
          min = test.distance;
        }
      }
    }
    return min;
  },

  _projectPointOnLineSegment: function(p, r0, r1) {
    var lineLength = r0.distanceTo(r1);
    if (lineLength < 1) {
        return {distance: p.distanceTo(r0), coordinate: r0};
    }
    var u = ((p.x - r0.x) * (r1.x - r0.x) + (p.y - r0.y) * (r1.y - r0.y)) / Math.pow(lineLength, 2);
    if (u < 0.0000001) {
        return {distance: p.distanceTo(r0), coordinate: r0};
    }
    if (u > 0.9999999) {
        return {distance: p.distanceTo(r1), coordinate: r1};
    }
    var a = L.point(r0.x + u * (r1.x - r0.x), r0.y + u * (r1.y - r0.y));
    return {distance: p.distanceTo(a), point: a};
  },

  initialize: function(mvtSource, options) {
    var self = this;
    self.mvtSource = mvtSource;
    L.Util.setOptions(this, options);

    this.style = options.style;
    this.name = options.name;
    this._canvasIDToFeatures = {};
    this.features = {};
    this.featuresWithLabels = [];
    this._highestCount = 0;
  },

  onAdd: function(map) {
    this.map = map;
    L.TileLayer.Canvas.prototype.onAdd.call(this, map);
  },

  onRemove: function(map) {
    this.fire('remove');
    removeLabels(this);
    L.TileLayer.Canvas.prototype.onRemove.call(this, map);
  },

  drawTile: function(canvas, tilePoint, zoom) {

    var ctx = {
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    ctx.id = Util.getContextID(ctx);

    if (!this._canvasIDToFeatures[ctx.id]) {
      this._initializeFeaturesHash(ctx);
    }
    if (!this.features) {
      this.features = {};
    }

  },

  _initializeFeaturesHash: function(ctx){
    this._canvasIDToFeatures[ctx.id] = {
      features: [],
      canvas: ctx.canvas,
      index: rbush(9)
    };
  },

  _draw: function(ctx) {
    //Draw is handled by the parent MVTSource object
  },
  getCanvas: function(parentCtx){
    //This gets called if a vector tile feature has already been parsed.
    //We've already got the geom, just get on with the drawing.
    //Need a way to pluck a canvas element from this layer given the parent layer's id.
    //Wait for it to get loaded before proceeding.
    var tilePoint = parentCtx.tile;
    var ctx = this._tiles[tilePoint.x + ":" + tilePoint.y];

    if(ctx){
      parentCtx.canvas = ctx;
      this.redrawTile(parentCtx.id);
      return;
    }

    var self = this;

    //This is a timer that will wait for a criterion to return true.
    //If not true within the timeout duration, it will move on.
    waitFor(function () {
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        if(ctx) {
          return true;
        }
      },
      function(){
        //When it finishes, do this.
        ctx = self._tiles[tilePoint.x + ":" + tilePoint.y];
        parentCtx.canvas = ctx;
        self.redrawTile(parentCtx.id);

      }, //when done, go to next flow
      2000); //The Timeout milliseconds.  After this, give up and move on

  },

  parseVectorTileLayer: function(vtl, ctx) {
    var self = this;
    var tilePoint = ctx.tile;
    var layerCtx  = { canvas: null, id: ctx.id, tile: ctx.tile, zoom: ctx.zoom, tileSize: ctx.tileSize};

    //See if we can pluck the child tile from this PBF tile layer based on the master layer's tile id.
    layerCtx.canvas = self._tiles[tilePoint.x + ":" + tilePoint.y];

    //Initialize this tile's feature storage hash, if it hasn't already been created.  Used for when filters are updated, and features are cleared to prepare for a fresh redraw.
    if (!this._canvasIDToFeatures[layerCtx.id]) {
      this._initializeFeaturesHash(layerCtx);
    }else{
      //Clear this tile's previously saved features.
      this.clearTileFeatureHash(layerCtx.id);
    }

    var features = vtl.parsedFeatures;
    var toIndex = [];
    for (var i = 0, len = features.length; i < len; i++) {
      var vtf = features[i]; //vector tile feature

      /**
       * Apply filter on feature if there is one. Defined in the options object
       * of TileLayer.MVTSource.js
       */
      var filter = self.options.filter;
      if (typeof filter === 'function') {
        if ( filter(vtf, layerCtx) === false ) continue;
      }

      var getIDForLayerFeature;
      if (typeof self.options.getIDForLayerFeature === 'function') {
        getIDForLayerFeature = self.options.getIDForLayerFeature;
      } else {
        getIDForLayerFeature = Util.getIDForLayerFeature;
      }
      var uniqueID = self.options.getIDForLayerFeature(vtf) || i;
      var mvtFeature = self.features[uniqueID];

      /**
       * Index the feature by bounding box into rbush.
       */
      var buffer = 0;
      // add buffer to index for points (ignore for other types)
      if (vtf.type === 1) { buffer = self.options.buffer; }
      var box = bbox(vtf, layerCtx.tileSize, uniqueID, buffer);
      toIndex.push(box);

      /**
       * Use layerOrdering function to apply a zIndex property to each vtf.  This is defined in
       * TileLayer.MVTSource.js.  Used below to sort features.npm
       */
      var layerOrdering = self.options.layerOrdering;
      if (typeof layerOrdering === 'function') {
        layerOrdering(vtf, layerCtx); //Applies a custom property to the feature, which is used after we're thru iterating to sort
      }

      //Create a new MVTFeature if one doesn't already exist for this feature.
      if (!mvtFeature) {

        //Get a style for the feature - set it just once for each new MVTFeature
        var style = self.style(vtf);

        //create a new feature
        self.features[uniqueID] = mvtFeature = new MVTFeature(self, vtf, layerCtx, uniqueID, style);
        if (style && style.dynamicLabel && typeof style.dynamicLabel === 'function') {
          self.featuresWithLabels.push(mvtFeature);
        }
      } else {
        //Add the new part to the existing feature
        mvtFeature.addTileFeature(vtf, layerCtx);
      }

      //Associate & Save this feature with this tile for later
      self._canvasIDToFeatures[layerCtx.id].features.push(mvtFeature);

    }
    self._canvasIDToFeatures[layerCtx.id].index.load(toIndex);

    /**
     * Apply sorting (zIndex) on feature if there is a function defined in the options object
     * of TileLayer.MVTSource.js
     */
    var layerOrdering = self.options.layerOrdering;
    if (layerOrdering) {
      //We've assigned the custom zIndex property when iterating above.  Now just sort.
      self._canvasIDToFeatures[layerCtx.id].features = self._canvasIDToFeatures[layerCtx.id].features.sort(function(a, b) {
        return -(b.properties.zIndex - a.properties.zIndex)
      });
    }

    self.redrawTile(layerCtx.id);
  },

  setStyle: function(styleFn) {
    // refresh the number for the highest count value
    // this is used only for choropleth
    this._highestCount = 0;

    // lowest count should not be 0, since we want to figure out the lowest
    this._lowestCount = null;

    this.style = styleFn;
    for (var key in this.features) {
      var feat = this.features[key];
      feat.setStyle(styleFn);
    }
    var z = this.map.getZoom();
    for (var key in this._tiles) {
      var id = z + ':' + key;
      this.redrawTile(id);
    }
  },

  /**
   * As counts for choropleths come in with the ajax data,
   * we want to keep track of which value is the highest
   * to create the color ramp for the fills of polygons.
   * @param count
   */
  setHighestCount: function(count) {
    if (count > this._highestCount) {
      this._highestCount = count;
    }
  },

  /**
   * Returns the highest number of all of the counts that have come in
   * from setHighestCount. This is assumed to be set via ajax callbacks.
   * @returns {number}
   */
  getHighestCount: function() {
    return this._highestCount;
  },

  setLowestCount: function(count) {
    if (!this._lowestCount || count < this._lowestCount) {
      this._lowestCount = count;
    }
  },

  getLowestCount: function() {
    return this._lowestCount;
  },

  setCountRange: function(count) {
    this.setHighestCount(count);
    this.setLowestCount(count);
  },

  featureAt: function(tileID, tilePixelPoint) {
    if (!this._canvasIDToFeatures[tileID]) return null; // break out

    var zoom = tileID.split(":")[0];
    var x = tilePixelPoint.x;
    var y = tilePixelPoint.y;

    var index = this._canvasIDToFeatures[tileID].index;

    var minDistance = Number.POSITIVE_INFINITY;
    var nearest = null;
    var j, paths, distance;

    var matches = index.search([x, y, x, y]);
    for (var i = 0; i < matches.length; i++) {
      var feature = this.features[matches[i].id];
      switch (feature.type) {

        case 1: //Point - currently rendered as circular paths.  Intersect with that.

          //Find the radius of the point.
          var radius = 3;
          if (typeof feature.style.radius === 'function') {
            radius = feature.style.radius(zoom); //Allows for scale dependent rednering
          }
          else{
            radius = feature.style.radius;
          }

          paths = feature.getPathsForTile(tileID);
          for (j = 0; j < paths.length; j++) {
            //Builds a circle of radius feature.style.radius (assuming circular point symbology).
            if(in_circle(paths[j][0].x, paths[j][0].y, radius, x, y)){
              nearest = feature;
              minDistance = 0;
            }
          }
          break;

        case 2: //LineString
          paths = feature.getPathsForTile(tileID);
          for (j = 0; j < paths.length; j++) {
            if (feature.style) {
              var distance = this._getDistanceFromLine(tilePixelPoint, paths[j]);
              var thickness = (feature.selected && feature.style.selected ? feature.style.selected.size : feature.style.size);
              if (distance < thickness / 2 + this.options.lineClickTolerance && distance < minDistance) {
                nearest = feature;
                minDistance = distance;
              }
            }
          }
          break;

        case 3: //Polygon
          paths = feature.getPathsForTile(tileID);
          for (j = 0; j < paths.length; j++) {
            if (this._isPointInPoly(tilePixelPoint, paths[j])) {
              nearest = feature;
              minDistance = 0; // point is inside the polygon, so distance is zero
            }
          }
          break;
      }
      if (minDistance == 0) break;
    }

    return nearest;
  },

  clearTile: function(id) {
    //id is the entire zoom:x:y.  we just want x:y.
    var ca = id.split(":");
    var canvasId = ca[1] + ":" + ca[2];
    if (typeof this._tiles[canvasId] === 'undefined') {
      console.error("typeof this._tiles[canvasId] === 'undefined'");
      return;
    }
    var canvas = this._tiles[canvasId];

    var context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  },

  clearTileFeatureHash: function(canvasID) {
    // Get rid of all saved features
    this._canvasIDToFeatures[canvasID].features = [];
    this._canvasIDToFeatures[canvasID].index = rbush(9);
  },

  clearLayerFeatureHash: function(){
    this.features = {};
  },

  redrawTile: function(canvasID) {
    //First, clear the canvas
    this.clearTile(canvasID);

    // If the features are not in the tile, then there is nothing to redraw.
    // This may happen if you call redraw before features have loaded and initially
    // drawn the tile.
    var featfeats = this._canvasIDToFeatures[canvasID];
    if (!featfeats) {
      return;
    }

    //Get the features for this tile, and redraw them.
    var features = featfeats.features;

    // we want to skip drawing the selected features and draw them last
    var selectedFeatures = [];

    // drawing all of the non-selected features
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      if (feature.selected) {
        selectedFeatures.push(feature);
      } else {
        feature.draw(canvasID);
      }
    }

    // drawing the selected features last
    for (var j = 0, len2 = selectedFeatures.length; j < len2; j++) {
      var selFeat = selectedFeatures[j];
      selFeat.draw(canvasID);
    }
  },

  linkedLayer: function() {
    if(this.mvtSource.layerLink) {
      var linkName = this.mvtSource.layerLink(this.name);
      return this.mvtSource.layers[linkName];
    }
    else{
      return null;
    }
  },

  featureWithLabelAdded: function(feature) {
    this.featuresWithLabels.push(feature);
  }

});

function bbox(vtf, tileSize, id, buffer) {
  var divisor = vtf.extent / tileSize;

  var minX = Number.POSITIVE_INFINITY;
  var maxX = Number.NEGATIVE_INFINITY;
  var minY = Number.POSITIVE_INFINITY;
  var maxY = Number.NEGATIVE_INFINITY;
  vtf.coordinates.forEach(function(coordinates) {
    coordinates.forEach(function(coordinate) {
      var x = coordinate.x / divisor;
      var y = coordinate.y / divisor;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if (buffer > 0) {
    minX -= buffer;
    maxX += buffer;
    minY -= buffer;
    maxY += buffer;
  }
  var box = [minX, minY, maxX, maxY];
  box.id = id;
  return box;
}


function removeLabels(self) {
  var features = self.featuresWithLabels;
  for (var i = 0, len = features.length; i < len; i++) {
    var feat = features[i];
    feat.removeLabel();
  }
  self.featuresWithLabels = [];
}

function in_circle(center_x, center_y, radius, x, y) {
  var square_dist = Math.pow((center_x - x), 2) + Math.pow((center_y - y), 2);
  return square_dist <= Math.pow(radius, 2);
}
/**
 * See https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
 *
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
  var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()), //< defensive code
    interval = setInterval(function () {
      if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
        // If not time-out yet and condition not yet fulfilled
        condition = (typeof (testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
      } else {
        if (!condition) {
          // If condition still not fulfilled (timeout but condition is 'false')
          console.log("'waitFor()' timeout");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('timeout'); //< Do what it's supposed to do once the condition is fulfilled
        } else {
          // Condition fulfilled (timeout and/or condition is 'true')
          console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
          clearInterval(interval); //< Stop this interval
          typeof (onReady) === "string" ? eval(onReady) : onReady('success'); //< Do what it's supposed to do once the condition is fulfilled
        }
      }
    }, 50); //< repeat check every 50ms
};

},{"./MVTFeature":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTFeature.js","./MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js","rbush":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/rbush/rbush.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTSource.js":[function(require,module,exports){
var VectorTile = require('vector-tile').VectorTile;
var Protobuf = require('pbf');
var Point = require('point-geometry');
var Util = require('./MVTUtil');
var MVTLayer = require('./MVTLayer');


module.exports = L.TileLayer.MVTSource = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    url: "", //URL TO Vector Tile Source,
    getIDForLayerFeature: function() {},
    tileSize: 256,
    visibleLayers: null,
    buffer: 5,
    xhrHeaders: {}
  },
  layers: {}, //Keep a list of the layers contained in the PBFs
  processedTiles: {}, //Keep a list of tiles that have been processed already
  _eventHandlers: {},
  _triggerOnTilesLoadedEvent: true, //whether or not to fire the onTilesLoaded event when all of the tiles finish loading.
  _url: "", //internal URL property

  style: function(feature) {
    var style = {};

    var type = feature.type;
    switch (type) {
      case 1: //'Point'
        style.color = 'rgba(49,79,79,1)';
        style.radius = 5;
        style.selected = {
          color: 'rgba(255,255,0,0.5)',
          radius: 6
        };
        break;
      case 2: //'LineString'
        style.color = 'rgba(161,217,155,0.8)';
        style.size = 3;
        style.selected = {
          color: 'rgba(255,25,0,0.5)',
          size: 4
        };
        break;
      case 3: //'Polygon'
        style.color = 'rgba(49,79,79,1)';
        style.outline = {
          color: 'rgba(161,217,155,0.8)',
          size: 1
        };
        style.selected = {
          color: 'rgba(255,140,0,0.3)',
          outline: {
            color: 'rgba(255,140,0,1)',
            size: 2
          }
        };
        break;
    }
    return style;
  },


  initialize: function(options) {
    L.Util.setOptions(this, options);

    //a list of the layers contained in the PBFs
    this.layers = {};

    // tiles currently in the viewport
    this.activeTiles = {};

    this._url = this.options.url;

    /**
     * For some reason, Leaflet has some code that resets the
     * z index in the options object. I'm having trouble tracking
     * down exactly what does this and why, so for now, we should
     * just copy the value to this.zIndex so we can have the right
     * number when we make the subsequent MVTLayers.
     */
    this.zIndex = options.zIndex;

    if (typeof options.style === 'function' || typeof options.style === 'object') {
      this.style = options.style;
    }

    if (typeof options.ajaxSource === 'function') {
      this.ajaxSource = options.ajaxSource;
    }

    this.layerLink = options.layerLink;

    this._eventHandlers = {};

    this._tilesToProcess = 0; //store the max number of tiles to be loaded.  Later, we can use this count to count down PBF loading.
  },

  redraw: function(triggerOnTilesLoadedEvent){
    //Only set to false if it actually is passed in as 'false'
    if (triggerOnTilesLoadedEvent === false) {
      this._triggerOnTilesLoadedEvent = false;
    }

    L.TileLayer.Canvas.prototype.redraw.call(this);
  },

  onAdd: function(map) {
    this.map = map;
    L.TileLayer.Canvas.prototype.onAdd.call(this, map);

    map.on('click', this._onClick, this);

    if (this.options.onHover){
        map.on('mousemove', this._onHover, this);
    }

    this.addChildLayers(map);

    if (typeof DynamicLabel === 'function' ) {
      this.dynamicLabel = new DynamicLabel(map, this, {});
    }
  },

  onRemove: function(map) {
    this.fire('remove');
    this.removeChildLayers(map);
    map.off('click', this._onClick, this);
    L.TileLayer.Canvas.prototype.onRemove.call(this, map);
    this.map = null;
  },

  drawTile: function(canvas, tilePoint, zoom) {
    var ctx = {
      id: [zoom, tilePoint.x, tilePoint.y].join(":"),
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    //Capture the max number of the tiles to load here. this._tilesToProcess is an internal number we use to know when we've finished requesting PBFs.
    if(this._tilesToProcess < this._tilesToLoad) this._tilesToProcess = this._tilesToLoad;

    var id = ctx.id = Util.getContextID(ctx);
    this.activeTiles[id] = ctx;

    if(!this.processedTiles[ctx.zoom]) this.processedTiles[ctx.zoom] = {};

    if (this.options.debug) {
      this._drawDebugInfo(ctx);
    }
    this._draw(ctx);
  },

  setOpacity:function(opacity) {
    this._setVisibleLayersStyle('opacity',opacity);
  },

  setZIndex:function(zIndex) {
    this._setVisibleLayersStyle('zIndex',zIndex);
  },

  _setVisibleLayersStyle:function(style, value) {
    for(var key in this.layers) {
      this.layers[key]._tileContainer.style[style] = value;
    }
  },

  _drawDebugInfo: function(ctx) {
    var max = this.options.tileSize;
    var g = ctx.canvas.getContext('2d');
    g.strokeStyle = '#000000';
    g.fillStyle = '#FFFF00';
    g.strokeRect(0, 0, max, max);
    g.font = "12px Arial";
    g.fillRect(0, 0, 5, 5);
    g.fillRect(0, max - 5, 5, 5);
    g.fillRect(max - 5, 0, 5, 5);
    g.fillRect(max - 5, max - 5, 5, 5);
    g.fillRect(max / 2 - 5, max / 2 - 5, 10, 10);
    g.strokeText(ctx.zoom + ' ' + ctx.tile.x + ' ' + ctx.tile.y, max / 2 - 30, max / 2 - 10);
  },

  _draw: function(ctx) {
    var self = this;

//    //This works to skip fetching and processing tiles if they've already been processed.
//    var vectorTile = this.processedTiles[ctx.zoom][ctx.id];
//    //if we've already parsed it, don't get it again.
//    if(vectorTile){
//      console.log("Skipping fetching " + ctx.id);
//      self.checkVectorTileLayers(parseVT(vectorTile), ctx, true);
//      self.reduceTilesToProcessCount();
//      return;
//    }

    if (!this._url) return;
    var src = this.getTileUrl({ x: ctx.tile.x, y: ctx.tile.y, z: ctx.zoom });

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (xhr.status == "200") {

        if(!xhr.response) return;

        var arrayBuffer = new Uint8Array(xhr.response);
        var buf = new Protobuf(arrayBuffer);
        var vt = new VectorTile(buf);
        // Check the attachment status of the layer.
        if (!self.map) {
          console.log("Fetched tile for removed map.");
          return;
        }
        // Check the current map layer zoom.  If fast zooming is occurring, then short circuit tiles that are for a different zoom level than we're currently on.
        if (self.map.getZoom() != ctx.zoom) {
          console.log("Fetched tile for zoom level " + ctx.zoom + ". Map is at zoom level " + self.map.getZoom());
          return;
        }
        self.checkVectorTileLayers(parseVT(vt), ctx);
      }

      //either way, reduce the count of tilesToProcess tiles here
      self.reduceTilesToProcessCount();
    };

    xhr.onerror = function() {
      console.log("xhr error: " + xhr.status)
    };

    xhr.open('GET', src, true); //async is true
    var headers = self.options.xhrHeaders;
    for (var header in headers) {
      xhr.setRequestHeader(header, headers[header]);
    }
    xhr.responseType = 'arraybuffer';
    xhr.send();
  },

  reduceTilesToProcessCount: function(){
    this._tilesToProcess--;
    if(!this._tilesToProcess){
      //Trigger event letting us know that all PBFs have been loaded and processed (or 404'd).
      if(this._eventHandlers["PBFLoad"]) this._eventHandlers["PBFLoad"]();
      this._pbfLoaded();
    }
  },

  checkVectorTileLayers: function(vt, ctx, parsed) {
    var self = this;

    //Check if there are specified visible layers
    var visibleLayers = self.options.visibleLayers;
    if (!visibleLayers) {
      visibleLayers = Object.keys(vt.layers);
    }

    var layerMapping = visibleLayers;
    if (Array.isArray(visibleLayers)) {
      layerMapping = {};
      for (var i=0; i < visibleLayers.length; i++) {
        layerMapping[visibleLayers[i]] = visibleLayers[i];
      }
    }

    for (var key in layerMapping) {
      var lyr = vt.layers[layerMapping[key]];
      if (lyr) {
        self.prepareMVTLayers(lyr, key, ctx, parsed);
      }
    }
  },

  prepareMVTLayers: function(lyr ,key, ctx, parsed) {
    var self = this;

    if (!self.layers[key]) {
      //Create MVTLayer or MVTPointLayer for user
      self.layers[key] = self.createMVTLayer(key, lyr.parsedFeatures[0].type || null);
    }

    if (parsed) {
      //We've already parsed it.  Go get canvas and draw.
      self.layers[key].getCanvas(ctx, lyr);
    } else {
      self.layers[key].parseVectorTileLayer(lyr, ctx);
    }

  },

  createMVTLayer: function(key, type) {
    var self = this;

    var getIDForLayerFeature;
    if (typeof self.options.getIDForLayerFeature === 'function') {
      getIDForLayerFeature = self.options.getIDForLayerFeature;
    } else {
      getIDForLayerFeature = Util.getIDForLayerFeature;
    }

    var style = self.style;
    if (typeof style === 'object') {
      style = style[key];
    }

    var options = {
      getIDForLayerFeature: getIDForLayerFeature,
      filter: self.options.filter,
      layerOrdering: self.options.layerOrdering,
      style: style,
      name: key,
      asynch: true,
      buffer: self.options.buffer
    };

    if (self.options.zIndex) {
      options.zIndex = self.zIndex;
    }

    //Take the layer and create a new MVTLayer or MVTPointLayer if one doesn't exist.
    var layer = new MVTLayer(self, options).addTo(self.map);

    return layer;
  },

  getLayers: function() {
    return this.layers;
  },

  hideLayer: function(id) {
    if (this.layers[id]) {
      this._map.removeLayer(this.layers[id]);
      var visibleLayers = this.options.visibleLayers;
      if (visibleLayers) {
        if (Array.isArray(visibleLayers) && visibleLayers.indexOf(id) > -1) {
          visibleLayers.splice(visibleLayers.indexOf(id), 1);
        } else {
          delete visibleLayers[id];
        }
      }
    }
  },

  showLayer: function(id) {
    if (this.layers[id]) {
      this._map.addLayer(this.layers[id]);
      var visibleLayers = this.options.visibleLayers;
      if (visibleLayers) {
        if (Array.isArray(visibleLayers)) {
          visibleLayers.push(id);
        } else {
          visibleLayers[id] = id;
        }
      }
    }
    //Make sure manager layer is always in front
    this.bringToFront();
  },

  removeChildLayers: function(map){
    //Remove child layers of this group layer
    for (var key in this.layers) {
      var layer = this.layers[key];
      map.removeLayer(layer);
    }
  },

  addChildLayers: function(map) {
    var visibleLayers = this.visibleLayers;
    if (visibleLayers) {
      //only let thru the layers listed in the visibleLayers array or object
      if (!Array.isArray(visibleLayers)) {
        visibleLayers = Object.keys(visibleLayers);
      }
      for(var i=0; i < visibleLayers.length; i++){
        var layerName = visibleLayers[i];
        var layer = this.layers[layerName];
        if(layer){
          //Proceed with parsing
          map.addLayer(layer);
        }
      }
    }else{
      //Add all layers
      for (var key in this.layers) {
        var layer = this.layers[key];
        // layer is set to visible and is not already on map
        if (!layer._map) {
          map.addLayer(layer);
        }
      }
    }
  },

  bind: function(eventType, callback) {
    this._eventHandlers[eventType] = callback;
  },

  featureAtLatLng: function(latlng) {
    return this.featureAtContainerPoint(this.map.latLngToContainerPoint(latlng));
  },

  featureAtContainerPoint: function(containerPoint) {
    return this._featureAt(containerPoint, this.layers);
  },

  _featureAt: function(containerPoint, layers) {
    var tilePoint = this._getTilePoint(containerPoint);

    // TODO: Z-ordering?  Clickable?
    for (var key in layers) {
      var layer = layers[key];
      var feature = layer.featureAt(tilePoint.tileID, tilePoint);
      if (feature) {
        return feature;
      }
    }
    return null;
  },

  _onHover: function(evt) {
    var self = this;
    var onHover = self.options.onHover;
    if (typeof onHover === 'function'){
        onHover(self, evt);
    }
  },

  _onClick: function(evt) {
    //Here, pass the event on to the child MVTLayer and have it do the hit test and handle the result.
    var self = this;
    var onClick = self.options.onClick;
    var clickableLayers = self.options.clickableLayers;
    var layers = self.layers;

    // We must have an array of clickable layers, otherwise, we just pass
    // the event to the public onClick callback in options.
    if (clickableLayers) {
      layers = {};
      for (var i = 0, len = clickableLayers.length; i < len; i++) {
        var key = clickableLayers[i];
        var layer = self.layers[key];
        if (layer) {
          layers[key] = layer;
        }
      }
    }

    var feature = this._featureAt(evt.containerPoint, layers);
    if (feature && feature.toggleEnabled) {
      feature.toggle();
    }

    evt.feature = feature;
    if (typeof onClick === 'function') {
      onClick(evt);
    }
  },

  setFilter: function(filterFunction, layerName) {
    //take in a new filter function.
    //Propagate to child layers.

    //Add filter to all child layers if no layer is specified.
    for (var key in this.layers) {
      var layer = this.layers[key];

      if (layerName){
        if(key.toLowerCase() == layerName.toLowerCase()){
          layer.options.filter = filterFunction; //Assign filter to child layer, only if name matches
          //After filter is set, the old feature hashes are invalid.  Clear them for next draw.
          layer.clearLayerFeatureHash();
          //layer.clearTileFeatureHash();
        }
      }
      else{
        layer.options.filter = filterFunction; //Assign filter to child layer
        //After filter is set, the old feature hashes are invalid.  Clear them for next draw.
        layer.clearLayerFeatureHash();
        //layer.clearTileFeatureHash();
      }
    }
  },

  /**
   * Take in a new style function and propogate to child layers.
   * If you do not set a layer name, it resets the style for all of the layers.
   * @param styleFunction
   * @param layerName
   */
  setStyle: function(styleFn, layerName) {
    for (var key in this.layers) {
      var layer = this.layers[key];
      if (layerName) {
        if(key.toLowerCase() == layerName.toLowerCase()) {
          layer.setStyle(styleFn);
        }
      } else {
        layer.setStyle(styleFn);
      }
    }
  },

  featureSelected: function(mvtFeature) {
    if (this.options.mutexToggle) {
      if (this._selectedFeature) {
        this._selectedFeature.deselect();
      }
      this._selectedFeature = mvtFeature;
    }
    if (this.options.onSelect) {
      this.options.onSelect(mvtFeature);
    }
  },

  featureDeselected: function(mvtFeature) {
    if (this.options.mutexToggle && this._selectedFeature) {
      this._selectedFeature = null;
    }
    if (this.options.onDeselect) {
      this.options.onDeselect(mvtFeature);
    }
  },

  _pbfLoaded: function() {
    //Fires when all tiles from this layer have been loaded and drawn (or 404'd).

    //Make sure manager layer is always in front
    this.bringToFront();

    //See if there is an event to execute
    var self = this;
    var onTilesLoaded = self.options.onTilesLoaded;

    if (onTilesLoaded && typeof onTilesLoaded === 'function' && this._triggerOnTilesLoadedEvent === true) {
      onTilesLoaded(this);
    }
    self._triggerOnTilesLoadedEvent = true; //reset - if redraw() is called with the optinal 'false' parameter to temporarily disable the onTilesLoaded event from firing.  This resets it back to true after a single time of firing as 'false'.
  },

  _getTilePoint: function(containerPoint) {
    var tileSize = this.options.tileSize;
    var globalPoint = this.map.containerPointToLayerPoint(containerPoint)
      .add(this.map.getPixelOrigin());

    var tileIndexPoint = globalPoint.divideBy(tileSize).floor();
    var tilePoint = globalPoint.subtract(tileIndexPoint.multiplyBy(tileSize));
    tilePoint.tileID = "" + this.map.getZoom() + ":" + tileIndexPoint.x + ":" + tileIndexPoint.y;
    return tilePoint;
  }

});


if (typeof(Number.prototype.toRad) === "undefined") {
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }
}

function parseVT(vt){
  for (var key in vt.layers) {
    var lyr = vt.layers[key];
    parseVTFeatures(lyr);
  }
  return vt;
}

function parseVTFeatures(vtl){
  vtl.parsedFeatures = [];
  var features = vtl._features;
  for (var i = 0, len = features.length; i < len; i++) {
    var vtf = vtl.feature(i);
    vtf.coordinates = vtf.loadGeometry();
    vtl.parsedFeatures.push(vtf);
  }
  return vtl;
}

},{"./MVTLayer":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTLayer.js","./MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js","pbf":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/pbf/index.js","point-geometry":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/point-geometry/index.js","vector-tile":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/node_modules/vector-tile/index.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js":[function(require,module,exports){
/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 8/15/14.
 */
var Util = module.exports = {};

Util.getContextID = function(ctx) {
  return [ctx.zoom, ctx.tile.x, ctx.tile.y].join(":");
};

/**
 * Default function that gets the id for a layer feature.
 * Sometimes this needs to be done in a different way and
 * can be specified by the user in the options for L.TileLayer.MVTSource.
 *
 * @param feature
 * @returns {ctx.id|*|id|string|jsts.index.chain.MonotoneChain.id|number}
 */
Util.getIDForLayerFeature = function(feature) {
  return feature.properties.id;
};

Util.getJSON = function(url, callback) {
  var xmlhttp = typeof XMLHttpRequest !== 'undefined' ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
  xmlhttp.onreadystatechange = function() {
    var status = xmlhttp.status;
    if (xmlhttp.readyState === 4 && status >= 200 && status < 300) {
      var json = JSON.parse(xmlhttp.responseText);
      callback(null, json);
    } else {
      callback( { error: true, status: status } );
    }
  };
  xmlhttp.open("GET", url, true);
  xmlhttp.send();
};

},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/StaticLabel/StaticLabel.js":[function(require,module,exports){
/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 7/31/14.
 */
var Util = require('../MVTUtil');
module.exports = StaticLabel;

function StaticLabel(mvtFeature, ctx, latLng, style) {
  var self = this;
  this.mvtFeature = mvtFeature;
  this.map = mvtFeature.map;
  this.zoom = ctx.zoom;
  this.latLng = latLng;
  this.selected = false;

  if (mvtFeature.linkedFeature) {
    var linkedFeature = mvtFeature.linkedFeature();
    if (linkedFeature && linkedFeature.selected) {
      self.selected = true;
    }
  }

  init(self, mvtFeature, ctx, latLng, style)
}

function init(self, mvtFeature, ctx, latLng, style) {
  var ajaxData = mvtFeature.ajaxData;
  var sty = self.style = style.staticLabel(mvtFeature, ajaxData);
  var icon = self.icon = L.divIcon({
    className: sty.cssClass || 'label-icon-text',
    html: sty.html,
    iconSize: sty.iconSize || [50,50]
  });

  self.marker = L.marker(latLng, {icon: icon}).addTo(self.map);

  if (self.selected) {
    self.marker._icon.classList.add(self.style.cssSelectedClass || 'label-icon-text-selected');
  }

  self.marker.on('click', self.toggle, self);

  self.map.on('zoomend', this._onZoomEnd, this);
}


StaticLabel.prototype.toggle = function() {
  if (this.selected) {
    this.deselect();
  } else {
    this.select();
  }
};

StaticLabel.prototype.select = function() {
  this.selected = true;
  this.marker._icon.classList.add(this.style.cssSelectedClass || 'label-icon-text-selected');
  var linkedFeature = this.mvtFeature.linkedFeature();
  if (!linkedFeature.selected) linkedFeature.select();
};

StaticLabel.prototype.deselect = function() {
  this.selected = false;
  this.marker._icon.classList.remove(this.style.cssSelectedClass || 'label-icon-text-selected');
  var linkedFeature = this.mvtFeature.linkedFeature();
  if (linkedFeature.selected) linkedFeature.deselect();
};

StaticLabel.prototype.remove = function() {
  if (!this.map || !this.marker) return;
  this.map.off('zoomend', this._onZoomEnd, this);
  this.map.removeLayer(this.marker);
};

StaticLabel.prototype._onZoomEnd = function() {
  var newZoom = e.target.getZoom();
  if (this.zoom !== newZoom) {
    this.remove();
  }
}

},{"../MVTUtil":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTUtil.js"}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/control/Control.MVTLayers.js":[function(require,module,exports){
/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

module.exports = L.Control.MVTLayers = L.Control.Layers.extend({

	initialize: function (baseLayers, overlays, options) {
		L.setOptions(this, options);

        // Map from vector layer name to presented name in toggle
        this._layerNames = this.options.layerNames || {};
		this._layers = {};
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this.addBaseLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this.addMVTLayer(overlays[i], i);
		}
	},

	addMVTLayer: function (layer, name) {

        var onTileLoad = function(mvtSrc){
            for (var key in mvtSrc.getLayers()){
                var name = this._layerNames[key] || key;
                this.addOverlay(mvtSrc.layers[key], name);
            }
            this._update();
        }
        layer.options.onTilesLoaded = onTileLoad.bind(this);
		return this._update();
	},

	_onInputClick: function () {
		var inputs = this._form.getElementsByTagName('input'),
		    input, layer, hasLayer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._layers[input.layerId].layer;
			hasLayer = this._map.hasLayer(layer);

			if (input.checked && !hasLayer) {
				addedLayers.push(layer);

			} else if (!input.checked && hasLayer) {
				removedLayers.push(layer);
			}
		}

		// Bugfix issue 2318: Should remove all old layers before readding new ones
		for (i = 0; i < removedLayers.length; i++) {
            var rl = removedLayers[i];

            // If we're removing a vector layer
            if (rl.mvtSource){
                rl.mvtSource.hideLayer(rl.name);
            } else {
                this._map.removeLayer(removedLayers[i]);
            }
		}
		for (i = 0; i < addedLayers.length; i++) {
            var al = addedLayers[i];

            // If we're adding a vector layer
            if (al.mvtSource){
                al.mvtSource.showLayer(al.name);
                al.mvtSource.redraw();
            } else {
                this._map.addLayer(addedLayers[i]);
            }
		}

		this._handlingClick = false;
		this._refocusOnMap();
	},
});

L.control.mvtLayers = function (baseLayers, overlays, options) {
	return new L.Control.MVTLayers(baseLayers, overlays, options);
};

L.DomUtil.empty = function (el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
};



},{}],"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/index.js":[function(require,module,exports){
/**
 * Copyright (c) 2014, Spatial Development International
 * All rights reserved.
 *
 * Source code can be found at:
 * https://github.com/SpatialServer/Leaflet.MapboxVectorTile
 *
 * @license ISC
 */

module.exports = {};
module.exports.MVTSource = require('./MVTSource');
module.exports.Control = {
    MVTLayers: require("./control/Control.MVTLayers")
};

},{"./MVTSource":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/MVTSource.js","./control/Control.MVTLayers":"/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/control/Control.MVTLayers.js"}]},{},["/Volumes/git/harfleur/Leaflet.MapboxVectorTile/src/index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pcy1hcnJheS9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3BiZi9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3BiZi9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3BvaW50LWdlb21ldHJ5L2luZGV4LmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvcmJ1c2gvcmJ1c2guanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL25vZGVfbW9kdWxlcy92ZWN0b3ItdGlsZS9pbmRleC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvbm9kZV9tb2R1bGVzL3ZlY3Rvci10aWxlL2xpYi92ZWN0b3J0aWxlLmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvdmVjdG9yLXRpbGUvbGliL3ZlY3RvcnRpbGVmZWF0dXJlLmpzIiwiL1ZvbHVtZXMvZ2l0L2hhcmZsZXVyL0xlYWZsZXQuTWFwYm94VmVjdG9yVGlsZS9ub2RlX21vZHVsZXMvdmVjdG9yLXRpbGUvbGliL3ZlY3RvcnRpbGVsYXllci5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVEZlYXR1cmUuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9NVlRMYXllci5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVFNvdXJjZS5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL01WVFV0aWwuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9TdGF0aWNMYWJlbC9TdGF0aWNMYWJlbC5qcyIsIi9Wb2x1bWVzL2dpdC9oYXJmbGV1ci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGUvc3JjL2NvbnRyb2wvQ29udHJvbC5NVlRMYXllcnMuanMiLCIvVm9sdW1lcy9naXQvaGFyZmxldXIvTGVhZmxldC5NYXBib3hWZWN0b3JUaWxlL3NyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1aENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDem1CQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25rQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzLWFycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIGtNYXhMZW5ndGggPSAweDNmZmZmZmZmXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIE5vdGU6XG4gKlxuICogLSBJbXBsZW1lbnRhdGlvbiBtdXN0IHN1cHBvcnQgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMuXG4gKiAgIEZpcmVmb3ggNC0yOSBsYWNrZWQgc3VwcG9ydCwgZml4ZWQgaW4gRmlyZWZveCAzMCsuXG4gKiAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG4gKlxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXkgd2lsbFxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgd2lsbCB3b3JrIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSAoZnVuY3Rpb24gKCkge1xuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIDQyID09PSBhcnIuZm9vKCkgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgbmV3IFVpbnQ4QXJyYXkoMSkuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gc3ViamVjdCA+IDAgPyBzdWJqZWN0ID4+PiAwIDogMFxuICBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGlmIChlbmNvZGluZyA9PT0gJ2Jhc2U2NCcpXG4gICAgICBzdWJqZWN0ID0gYmFzZTY0Y2xlYW4oc3ViamVjdClcbiAgICBsZW5ndGggPSBCdWZmZXIuYnl0ZUxlbmd0aChzdWJqZWN0LCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JyAmJiBzdWJqZWN0ICE9PSBudWxsKSB7IC8vIGFzc3VtZSBvYmplY3QgaXMgYXJyYXktbGlrZVxuICAgIGlmIChzdWJqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkoc3ViamVjdC5kYXRhKSlcbiAgICAgIHN1YmplY3QgPSBzdWJqZWN0LmRhdGFcbiAgICBsZW5ndGggPSArc3ViamVjdC5sZW5ndGggPiAwID8gTWF0aC5mbG9vcigrc3ViamVjdC5sZW5ndGgpIDogMFxuICB9IGVsc2VcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG5cbiAgaWYgKHRoaXMubGVuZ3RoID4ga01heExlbmd0aClcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuXG4gIHZhciBidWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIHR5cGVvZiBzdWJqZWN0LmJ5dGVMZW5ndGggPT09ICdudW1iZXInKSB7XG4gICAgLy8gU3BlZWQgb3B0aW1pemF0aW9uIC0tIHVzZSBzZXQgaWYgd2UncmUgY29weWluZyBmcm9tIGEgdHlwZWQgYXJyYXlcbiAgICBidWYuX3NldChzdWJqZWN0KVxuICB9IGVsc2UgaWYgKGlzQXJyYXlpc2goc3ViamVjdCkpIHtcbiAgICAvLyBUcmVhdCBhcnJheS1pc2ggb2JqZWN0cyBhcyBhIGJ5dGUgYXJyYXlcbiAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpKSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3QucmVhZFVJbnQ4KGkpXG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYnVmW2ldID0gKChzdWJqZWN0W2ldICUgMjU2KSArIDI1NikgJSAyNTZcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBidWYud3JpdGUoc3ViamVjdCwgMCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmICFub1plcm8pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZltpXSA9IDBcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSlcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuICYmIGFbaV0gPT09IGJbaV07IGkrKykge31cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gKGxpc3QsIHRvdGFsTGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVXNhZ2U6IEJ1ZmZlci5jb25jYXQobGlzdFssIGxlbmd0aF0pJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmICh0b3RhbExlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdG90YWxMZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRvdGFsTGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodG90YWxMZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggKiAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoID4+PiAxXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG4vLyBwcmUtc2V0IGZvciB2YWx1ZXMgdGhhdCBtYXkgZXhpc3QgaW4gdGhlIGZ1dHVyZVxuQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbkJ1ZmZlci5wcm90b3R5cGUucGFyZW50ID0gdW5kZWZpbmVkXG5cbi8vIHRvU3RyaW5nKGVuY29kaW5nLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSlcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKGIpIHtcbiAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpXG4gICAgICBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihieXRlKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gdXRmMTZsZVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aCwgMilcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSB1dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBhc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuO1xuICAgIGlmIChzdGFydCA8IDApXG4gICAgICBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMClcbiAgICAgIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydClcbiAgICBlbmQgPSBzdGFydFxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHJldHVybiBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIHZhciBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQsIHRydWUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0J1ZlxuICB9XG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpXG4gICAgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdidWZmZXIgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VFbmQgPCBzb3VyY2VTdGFydCcpXG4gIGlmICh0YXJnZXRfc3RhcnQgPCAwIHx8IHRhcmdldF9zdGFydCA+PSB0YXJnZXQubGVuZ3RoKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHNvdXJjZS5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiBzb3VyY2UubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRfc3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0X3N0YXJ0KVxuICB9XG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAgIHJldHVybiAobmV3IEJ1ZmZlcih0aGlzKSkuYnVmZmVyXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbmd0aClcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBidWYubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgfVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQnVmZmVyLnRvQXJyYXlCdWZmZXIgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInKVxuICB9XG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIEJQID0gQnVmZmVyLnByb3RvdHlwZVxuXG4vKipcbiAqIEF1Z21lbnQgYSBVaW50OEFycmF5ICppbnN0YW5jZSogKG5vdCB0aGUgVWludDhBcnJheSBjbGFzcyEpIHdpdGggQnVmZmVyIG1ldGhvZHNcbiAqL1xuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuY29uc3RydWN0b3IgPSBCdWZmZXJcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLXpdL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKSB7XG4gICAgICBieXRlQXJyYXkucHVzaChiKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGJ5dGVBcnJheS5wdXNoKHBhcnNlSW50KGhbal0sIDE2KSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoc3RyKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgsIHVuaXRTaXplKSB7XG4gIGlmICh1bml0U2l6ZSkgbGVuZ3RoIC09IGxlbmd0aCAlIHVuaXRTaXplO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKVxuICAgICAgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cbiIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsIlxuLyoqXG4gKiBpc0FycmF5XG4gKi9cblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuXG4vKipcbiAqIHRvU3RyaW5nXG4gKi9cblxudmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogV2hldGhlciBvciBub3QgdGhlIGdpdmVuIGB2YWxgXG4gKiBpcyBhbiBhcnJheS5cbiAqXG4gKiBleGFtcGxlOlxuICpcbiAqICAgICAgICBpc0FycmF5KFtdKTtcbiAqICAgICAgICAvLyA+IHRydWVcbiAqICAgICAgICBpc0FycmF5KGFyZ3VtZW50cyk7XG4gKiAgICAgICAgLy8gPiBmYWxzZVxuICogICAgICAgIGlzQXJyYXkoJycpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqXG4gKiBAcGFyYW0ge21peGVkfSB2YWxcbiAqIEByZXR1cm4ge2Jvb2x9XG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5IHx8IGZ1bmN0aW9uICh2YWwpIHtcbiAgcmV0dXJuICEhIHZhbCAmJiAnW29iamVjdCBBcnJheV0nID09IHN0ci5jYWxsKHZhbCk7XG59O1xuIiwiKGZ1bmN0aW9uIChCdWZmZXIpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm90b2J1ZjtcbmZ1bmN0aW9uIFByb3RvYnVmKGJ1Zikge1xuICAgIHRoaXMuYnVmID0gYnVmO1xuICAgIHRoaXMucG9zID0gMDtcbn1cblxuUHJvdG9idWYucHJvdG90eXBlID0ge1xuICAgIGdldCBsZW5ndGgoKSB7IHJldHVybiB0aGlzLmJ1Zi5sZW5ndGg7IH1cbn07XG5cblByb3RvYnVmLlZhcmludCA9IDA7XG5Qcm90b2J1Zi5JbnQ2NCA9IDE7XG5Qcm90b2J1Zi5NZXNzYWdlID0gMjtcblByb3RvYnVmLlN0cmluZyA9IDI7XG5Qcm90b2J1Zi5QYWNrZWQgPSAyO1xuUHJvdG9idWYuSW50MzIgPSA1O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYnVmID0gbnVsbDtcbn07XG5cbi8vID09PSBSRUFESU5HID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkVUludDMyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZhbCA9IHRoaXMuYnVmLnJlYWRVSW50MzJMRSh0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gNDtcbiAgICByZXR1cm4gdmFsO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRVSW50NjQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmFsID0gdGhpcy5idWYucmVhZFVJbnQ2NExFKHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSA4O1xuICAgIHJldHVybiB2YWw7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZERvdWJsZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2YWwgPSBpZWVlNzU0LnJlYWQodGhpcy5idWYsIHRoaXMucG9zLCB0cnVlLCA1MiwgOCk7XG4gICAgdGhpcy5wb3MgKz0gODtcbiAgICByZXR1cm4gdmFsO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRWYXJpbnQgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBUT0RPOiBib3VuZHMgY2hlY2tpbmdcbiAgICB2YXIgcG9zID0gdGhpcy5wb3M7XG4gICAgaWYgKHRoaXMuYnVmW3Bvc10gPD0gMHg3Zikge1xuICAgICAgICB0aGlzLnBvcysrO1xuICAgICAgICByZXR1cm4gdGhpcy5idWZbcG9zXTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDFdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gMjtcbiAgICAgICAgcmV0dXJuICh0aGlzLmJ1Zltwb3NdICYgMHg3ZikgfCAodGhpcy5idWZbcG9zICsgMV0gPDwgNyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ1Zltwb3MgKyAyXSA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucG9zICs9IDM7XG4gICAgICAgIHJldHVybiAodGhpcy5idWZbcG9zXSAmIDB4N2YpIHwgKHRoaXMuYnVmW3BvcyArIDFdICYgMHg3ZikgPDwgNyB8ICh0aGlzLmJ1Zltwb3MgKyAyXSkgPDwgMTQ7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ1Zltwb3MgKyAzXSA8PSAweDdmKSB7XG4gICAgICAgIHRoaXMucG9zICs9IDQ7XG4gICAgICAgIHJldHVybiAodGhpcy5idWZbcG9zXSAmIDB4N2YpIHwgKHRoaXMuYnVmW3BvcyArIDFdICYgMHg3ZikgPDwgNyB8ICh0aGlzLmJ1Zltwb3MgKyAyXSAmIDB4N2YpIDw8IDE0IHwgKHRoaXMuYnVmW3BvcyArIDNdKSA8PCAyMTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnVmW3BvcyArIDRdIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5wb3MgKz0gNTtcbiAgICAgICAgcmV0dXJuICgodGhpcy5idWZbcG9zXSAmIDB4N2YpIHwgKHRoaXMuYnVmW3BvcyArIDFdICYgMHg3ZikgPDwgNyB8ICh0aGlzLmJ1Zltwb3MgKyAyXSAmIDB4N2YpIDw8IDE0IHwgKHRoaXMuYnVmW3BvcyArIDNdKSA8PCAyMSkgKyAodGhpcy5idWZbcG9zICsgNF0gKiAyNjg0MzU0NTYpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2tpcChQcm90b2J1Zi5WYXJpbnQpO1xuICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgLy8gdGhyb3cgbmV3IEVycm9yKFwiVE9ETzogSGFuZGxlIDYrIGJ5dGUgdmFyaW50c1wiKTtcbiAgICB9XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUucmVhZFNWYXJpbnQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbnVtID0gdGhpcy5yZWFkVmFyaW50KCk7XG4gICAgaWYgKG51bSA+IDIxNDc0ODM2NDcpIHRocm93IG5ldyBFcnJvcignVE9ETzogSGFuZGxlIG51bWJlcnMgPj0gMl4zMCcpO1xuICAgIC8vIHppZ3phZyBlbmNvZGluZ1xuICAgIHJldHVybiAoKG51bSA+PiAxKSBeIC0obnVtICYgMSkpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLnJlYWRWYXJpbnQoKTtcbiAgICAvLyBUT0RPOiBib3VuZHMgY2hlY2tpbmdcbiAgICB2YXIgY2hyID0gU3RyaW5nLmZyb21DaGFyQ29kZTtcbiAgICB2YXIgYiA9IHRoaXMuYnVmO1xuICAgIHZhciBwID0gdGhpcy5wb3M7XG4gICAgdmFyIGVuZCA9IHRoaXMucG9zICsgYnl0ZXM7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHdoaWxlIChwIDwgZW5kKSB7XG4gICAgICAgIGlmIChiW3BdIDw9IDB4N0YpIHN0ciArPSBjaHIoYltwKytdKTtcbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEJGKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgVVRGLTggY29kZXBvaW50OiAnICsgYltwXSk7XG4gICAgICAgIGVsc2UgaWYgKGJbcF0gPD0gMHhERikgc3RyICs9IGNocigoYltwKytdICYgMHgxRikgPDwgNiB8IChiW3ArK10gJiAweDNGKSk7XG4gICAgICAgIGVsc2UgaWYgKGJbcF0gPD0gMHhFRikgc3RyICs9IGNocigoYltwKytdICYgMHgxRikgPDwgMTIgfCAoYltwKytdICYgMHgzRikgPDwgNiB8IChiW3ArK10gJiAweDNGKSk7XG4gICAgICAgIGVsc2UgaWYgKGJbcF0gPD0gMHhGNykgcCArPSA0OyAvLyBXZSBjYW4ndCBoYW5kbGUgdGhlc2UgY29kZXBvaW50cyBpbiBKUywgc28gc2tpcC5cbiAgICAgICAgZWxzZSBpZiAoYltwXSA8PSAweEZCKSBwICs9IDU7XG4gICAgICAgIGVsc2UgaWYgKGJbcF0gPD0gMHhGRCkgcCArPSA2O1xuICAgICAgICBlbHNlIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVVEYtOCBjb2RlcG9pbnQ6ICcgKyBiW3BdKTtcbiAgICB9XG4gICAgdGhpcy5wb3MgKz0gYnl0ZXM7XG4gICAgcmV0dXJuIHN0cjtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS5yZWFkQnVmZmVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ5dGVzID0gdGhpcy5yZWFkVmFyaW50KCk7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuYnVmLnN1YmFycmF5KHRoaXMucG9zLCB0aGlzLnBvcyArIGJ5dGVzKTtcbiAgICB0aGlzLnBvcyArPSBieXRlcztcbiAgICByZXR1cm4gYnVmZmVyO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWRQYWNrZWQgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgLy8gVE9ETzogYm91bmRzIGNoZWNraW5nXG4gICAgdmFyIGJ5dGVzID0gdGhpcy5yZWFkVmFyaW50KCk7XG4gICAgdmFyIGVuZCA9IHRoaXMucG9zICsgYnl0ZXM7XG4gICAgdmFyIGFycmF5ID0gW107XG4gICAgd2hpbGUgKHRoaXMucG9zIDwgZW5kKSB7XG4gICAgICAgIGFycmF5LnB1c2godGhpc1sncmVhZCcgKyB0eXBlXSgpKTtcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5O1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnNraXAgPSBmdW5jdGlvbih2YWwpIHtcbiAgICAvLyBUT0RPOiBib3VuZHMgY2hlY2tpbmdcbiAgICB2YXIgdHlwZSA9IHZhbCAmIDB4NztcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgLyogdmFyaW50ICovIGNhc2UgUHJvdG9idWYuVmFyaW50OiB3aGlsZSAodGhpcy5idWZbdGhpcy5wb3MrK10gPiAweDdmKTsgYnJlYWs7XG4gICAgICAgIC8qIDY0IGJpdCAqLyBjYXNlIFByb3RvYnVmLkludDY0OiB0aGlzLnBvcyArPSA4OyBicmVhaztcbiAgICAgICAgLyogbGVuZ3RoICovIGNhc2UgUHJvdG9idWYuTWVzc2FnZTogdmFyIGJ5dGVzID0gdGhpcy5yZWFkVmFyaW50KCk7IHRoaXMucG9zICs9IGJ5dGVzOyBicmVhaztcbiAgICAgICAgLyogMzIgYml0ICovIGNhc2UgUHJvdG9idWYuSW50MzI6IHRoaXMucG9zICs9IDQ7IGJyZWFrO1xuICAgICAgICBkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoJ1VuaW1wbGVtZW50ZWQgdHlwZTogJyArIHR5cGUpO1xuICAgIH1cbn07XG5cbi8vID09PSBXUklUSU5HID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZyA9IGZ1bmN0aW9uKHRhZywgdHlwZSkge1xuICAgIHRoaXMud3JpdGVWYXJpbnQoKHRhZyA8PCAzKSB8IHR5cGUpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLnJlYWxsb2MgPSBmdW5jdGlvbihtaW4pIHtcbiAgICB2YXIgbGVuZ3RoID0gdGhpcy5idWYubGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGggPCB0aGlzLnBvcyArIG1pbikgbGVuZ3RoICo9IDI7XG4gICAgaWYgKGxlbmd0aCAhPSB0aGlzLmJ1Zi5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKTtcbiAgICAgICAgdGhpcy5idWYuY29weShidWYpO1xuICAgICAgICB0aGlzLmJ1ZiA9IGJ1ZjtcbiAgICB9XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUuZmluaXNoID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmLnNsaWNlKDAsIHRoaXMucG9zKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVBhY2tlZCA9IGZ1bmN0aW9uKHR5cGUsIHRhZywgaXRlbXMpIHtcbiAgICBpZiAoIWl0ZW1zLmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgdmFyIG1lc3NhZ2UgPSBuZXcgUHJvdG9idWYoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG1lc3NhZ2VbJ3dyaXRlJyArIHR5cGVdKGl0ZW1zW2ldKTtcbiAgICB9XG4gICAgdmFyIGRhdGEgPSBtZXNzYWdlLmZpbmlzaCgpO1xuXG4gICAgdGhpcy53cml0ZVRhZyh0YWcsIFByb3RvYnVmLlBhY2tlZCk7XG4gICAgdGhpcy53cml0ZUJ1ZmZlcihkYXRhKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVVJbnQzMiA9IGZ1bmN0aW9uKHZhbCkge1xuICAgIHRoaXMucmVhbGxvYyg0KTtcbiAgICB0aGlzLmJ1Zi53cml0ZVVJbnQzMkxFKHZhbCwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IDQ7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRVSW50MzIgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5JbnQzMik7XG4gICAgdGhpcy53cml0ZVVJbnQzMih2YWwpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVmFyaW50ID0gZnVuY3Rpb24odmFsKSB7XG4gICAgdmFsID0gTnVtYmVyKHZhbCk7XG4gICAgaWYgKGlzTmFOKHZhbCkpIHtcbiAgICAgICAgdmFsID0gMDtcbiAgICB9XG5cbiAgICBpZiAodmFsIDw9IDB4N2YpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDEpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IHZhbDtcbiAgICB9IGVsc2UgaWYgKHZhbCA8PSAweDNmZmYpIHtcbiAgICAgICAgdGhpcy5yZWFsbG9jKDIpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMCkgJiAweDdmKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDAwIHwgKCh2YWwgPj4+IDcpICYgMHg3Zik7XG4gICAgfSBlbHNlIGlmICh2YWwgPD0gMHgxZmZmZmZmKSB7XG4gICAgICAgIHRoaXMucmVhbGxvYygzKTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDApICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiA3KSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4MDAgfCAoKHZhbCA+Pj4gMTQpICYgMHg3Zik7XG4gICAgfSBlbHNlIGlmICh2YWwgPD0gMHhmZmZmZmZmKSB7XG4gICAgICAgIHRoaXMucmVhbGxvYyg0KTtcbiAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSAweDgwIHwgKCh2YWwgPj4+IDApICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHg4MCB8ICgodmFsID4+PiA3KSAmIDB4N2YpO1xuICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvcysrXSA9IDB4ODAgfCAoKHZhbCA+Pj4gMTQpICYgMHg3Zik7XG4gICAgICAgIHRoaXMuYnVmW3RoaXMucG9zKytdID0gMHgwMCB8ICgodmFsID4+PiAyMSkgJiAweDdmKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB3aGlsZSAodmFsID4gMCkge1xuICAgICAgICAgICAgdmFyIGIgPSB2YWwgJiAweDdmO1xuICAgICAgICAgICAgdmFsID0gTWF0aC5mbG9vcih2YWwgLyAxMjgpO1xuICAgICAgICAgICAgaWYgKHZhbCA+IDApIGIgfD0gMHg4MFxuICAgICAgICAgICAgdGhpcy5yZWFsbG9jKDEpO1xuICAgICAgICAgICAgdGhpcy5idWZbdGhpcy5wb3MrK10gPSBiO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkVmFyaW50ID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuVmFyaW50KTtcbiAgICB0aGlzLndyaXRlVmFyaW50KHZhbCk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVTVmFyaW50ID0gZnVuY3Rpb24odmFsKSB7XG4gICAgaWYgKHZhbCA+PSAwKSB7XG4gICAgICAgIHRoaXMud3JpdGVWYXJpbnQodmFsICogMik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy53cml0ZVZhcmludCh2YWwgKiAtMiAtIDEpO1xuICAgIH1cbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZVRhZ2dlZFNWYXJpbnQgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5WYXJpbnQpO1xuICAgIHRoaXMud3JpdGVTVmFyaW50KHZhbCk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVCb29sZWFuID0gZnVuY3Rpb24odmFsKSB7XG4gICAgdGhpcy53cml0ZVZhcmludChCb29sZWFuKHZhbCkpO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkQm9vbGVhbiA9IGZ1bmN0aW9uKHRhZywgdmFsKSB7XG4gICAgdGhpcy53cml0ZVRhZ2dlZFZhcmludCh0YWcsIEJvb2xlYW4odmFsKSk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVTdHJpbmcgPSBmdW5jdGlvbihzdHIpIHtcbiAgICBzdHIgPSBTdHJpbmcoc3RyKTtcbiAgICB2YXIgYnl0ZXMgPSBCdWZmZXIuYnl0ZUxlbmd0aChzdHIpO1xuICAgIHRoaXMud3JpdGVWYXJpbnQoYnl0ZXMpO1xuICAgIHRoaXMucmVhbGxvYyhieXRlcyk7XG4gICAgdGhpcy5idWYud3JpdGUoc3RyLCB0aGlzLnBvcyk7XG4gICAgdGhpcy5wb3MgKz0gYnl0ZXM7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVUYWdnZWRTdHJpbmcgPSBmdW5jdGlvbih0YWcsIHN0cikge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5TdHJpbmcpO1xuICAgIHRoaXMud3JpdGVTdHJpbmcoc3RyKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZUZsb2F0ID0gZnVuY3Rpb24odmFsKSB7XG4gICAgdGhpcy5yZWFsbG9jKDQpO1xuICAgIHRoaXMuYnVmLndyaXRlRmxvYXRMRSh2YWwsIHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSA0O1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkRmxvYXQgPSBmdW5jdGlvbih0YWcsIHZhbCkge1xuICAgIHRoaXMud3JpdGVUYWcodGFnLCBQcm90b2J1Zi5JbnQzMik7XG4gICAgdGhpcy53cml0ZUZsb2F0KHZhbCk7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVEb3VibGUgPSBmdW5jdGlvbih2YWwpIHtcbiAgICB0aGlzLnJlYWxsb2MoOCk7XG4gICAgdGhpcy5idWYud3JpdGVEb3VibGVMRSh2YWwsIHRoaXMucG9zKTtcbiAgICB0aGlzLnBvcyArPSA4O1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkRG91YmxlID0gZnVuY3Rpb24odGFnLCB2YWwpIHtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuSW50NjQpO1xuICAgIHRoaXMud3JpdGVEb3VibGUodmFsKTtcbn07XG5cblByb3RvYnVmLnByb3RvdHlwZS53cml0ZUJ1ZmZlciA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgIHZhciBieXRlcyA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgdGhpcy53cml0ZVZhcmludChieXRlcyk7XG4gICAgdGhpcy5yZWFsbG9jKGJ5dGVzKTtcbiAgICBidWZmZXIuY29weSh0aGlzLmJ1ZiwgdGhpcy5wb3MpO1xuICAgIHRoaXMucG9zICs9IGJ5dGVzO1xufTtcblxuUHJvdG9idWYucHJvdG90eXBlLndyaXRlVGFnZ2VkQnVmZmVyID0gZnVuY3Rpb24odGFnLCBidWZmZXIpIHtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuU3RyaW5nKTtcbiAgICB0aGlzLndyaXRlQnVmZmVyKGJ1ZmZlcik7XG59O1xuXG5Qcm90b2J1Zi5wcm90b3R5cGUud3JpdGVNZXNzYWdlID0gZnVuY3Rpb24odGFnLCBwcm90b2J1Zikge1xuICAgIHZhciBidWZmZXIgPSBwcm90b2J1Zi5maW5pc2goKTtcbiAgICB0aGlzLndyaXRlVGFnKHRhZywgUHJvdG9idWYuTWVzc2FnZSk7XG4gICAgdGhpcy53cml0ZUJ1ZmZlcihidWZmZXIpO1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyKVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OXdZbVl2YVc1a1pYZ3Vhbk1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJanRCUVVGQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCcFpXVmxOelUwSUQwZ2NtVnhkV2x5WlNnbmFXVmxaVGMxTkNjcE8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRkJ5YjNSdlluVm1PMXh1Wm5WdVkzUnBiMjRnVUhKdmRHOWlkV1lvWW5WbUtTQjdYRzRnSUNBZ2RHaHBjeTVpZFdZZ1BTQmlkV1k3WEc0Z0lDQWdkR2hwY3k1d2IzTWdQU0F3TzF4dWZWeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1VnUFNCN1hHNGdJQ0FnWjJWMElHeGxibWQwYUNncElIc2djbVYwZFhKdUlIUm9hWE11WW5WbUxteGxibWQwYURzZ2ZWeHVmVHRjYmx4dVVISnZkRzlpZFdZdVZtRnlhVzUwSUQwZ01EdGNibEJ5YjNSdlluVm1Ma2x1ZERZMElEMGdNVHRjYmxCeWIzUnZZblZtTGsxbGMzTmhaMlVnUFNBeU8xeHVVSEp2ZEc5aWRXWXVVM1J5YVc1bklEMGdNanRjYmxCeWIzUnZZblZtTGxCaFkydGxaQ0E5SURJN1hHNVFjbTkwYjJKMVppNUpiblF6TWlBOUlEVTdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1a1pYTjBjbTk1SUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUNBZ2RHaHBjeTVpZFdZZ1BTQnVkV3hzTzF4dWZUdGNibHh1THk4Z1BUMDlJRkpGUVVSSlRrY2dQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDFjYmx4dVVISnZkRzlpZFdZdWNISnZkRzkwZVhCbExuSmxZV1JWU1c1ME16SWdQU0JtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0IyWVhJZ2RtRnNJRDBnZEdocGN5NWlkV1l1Y21WaFpGVkpiblF6TWt4RktIUm9hWE11Y0c5ektUdGNiaUFnSUNCMGFHbHpMbkJ2Y3lBclBTQTBPMXh1SUNBZ0lISmxkSFZ5YmlCMllXdzdYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVjbVZoWkZWSmJuUTJOQ0E5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUhaaGNpQjJZV3dnUFNCMGFHbHpMbUoxWmk1eVpXRmtWVWx1ZERZMFRFVW9kR2hwY3k1d2IzTXBPMXh1SUNBZ0lIUm9hWE11Y0c5eklDczlJRGc3WEc0Z0lDQWdjbVYwZFhKdUlIWmhiRHRjYm4wN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzV5WldGa1JHOTFZbXhsSUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUNBZ2RtRnlJSFpoYkNBOUlHbGxaV1UzTlRRdWNtVmhaQ2gwYUdsekxtSjFaaXdnZEdocGN5NXdiM01zSUhSeWRXVXNJRFV5TENBNEtUdGNiaUFnSUNCMGFHbHpMbkJ2Y3lBclBTQTRPMXh1SUNBZ0lISmxkSFZ5YmlCMllXdzdYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVjbVZoWkZaaGNtbHVkQ0E5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUM4dklGUlBSRTg2SUdKdmRXNWtjeUJqYUdWamEybHVaMXh1SUNBZ0lIWmhjaUJ3YjNNZ1BTQjBhR2x6TG5CdmN6dGNiaUFnSUNCcFppQW9kR2hwY3k1aWRXWmJjRzl6WFNBOFBTQXdlRGRtS1NCN1hHNGdJQ0FnSUNBZ0lIUm9hWE11Y0c5ekt5czdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQjBhR2x6TG1KMVpsdHdiM05kTzF4dUlDQWdJSDBnWld4elpTQnBaaUFvZEdocGN5NWlkV1piY0c5eklDc2dNVjBnUEQwZ01IZzNaaWtnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbkJ2Y3lBclBTQXlPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdLSFJvYVhNdVluVm1XM0J2YzEwZ0ppQXdlRGRtS1NCOElDaDBhR2x6TG1KMVpsdHdiM01nS3lBeFhTQThQQ0EzS1R0Y2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0hSb2FYTXVZblZtVzNCdmN5QXJJREpkSUR3OUlEQjROMllwSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV3YjNNZ0t6MGdNenRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJQ2gwYUdsekxtSjFabHR3YjNOZElDWWdNSGczWmlrZ2ZDQW9kR2hwY3k1aWRXWmJjRzl6SUNzZ01WMGdKaUF3ZURkbUtTQThQQ0EzSUh3Z0tIUm9hWE11WW5WbVczQnZjeUFySURKZEtTQThQQ0F4TkR0Y2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0hSb2FYTXVZblZtVzNCdmN5QXJJRE5kSUR3OUlEQjROMllwSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV3YjNNZ0t6MGdORHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJQ2gwYUdsekxtSjFabHR3YjNOZElDWWdNSGczWmlrZ2ZDQW9kR2hwY3k1aWRXWmJjRzl6SUNzZ01WMGdKaUF3ZURkbUtTQThQQ0EzSUh3Z0tIUm9hWE11WW5WbVczQnZjeUFySURKZElDWWdNSGczWmlrZ1BEd2dNVFFnZkNBb2RHaHBjeTVpZFdaYmNHOXpJQ3NnTTEwcElEdzhJREl4TzF4dUlDQWdJSDBnWld4elpTQnBaaUFvZEdocGN5NWlkV1piY0c5eklDc2dORjBnUEQwZ01IZzNaaWtnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbkJ2Y3lBclBTQTFPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdLQ2gwYUdsekxtSjFabHR3YjNOZElDWWdNSGczWmlrZ2ZDQW9kR2hwY3k1aWRXWmJjRzl6SUNzZ01WMGdKaUF3ZURkbUtTQThQQ0EzSUh3Z0tIUm9hWE11WW5WbVczQnZjeUFySURKZElDWWdNSGczWmlrZ1BEd2dNVFFnZkNBb2RHaHBjeTVpZFdaYmNHOXpJQ3NnTTEwcElEdzhJREl4S1NBcklDaDBhR2x6TG1KMVpsdHdiM01nS3lBMFhTQXFJREkyT0RRek5UUTFOaWs3WEc0Z0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdkR2hwY3k1emEybHdLRkJ5YjNSdlluVm1MbFpoY21sdWRDazdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQXdPMXh1SUNBZ0lDQWdJQ0F2THlCMGFISnZkeUJ1WlhjZ1JYSnliM0lvWENKVVQwUlBPaUJJWVc1a2JHVWdOaXNnWW5sMFpTQjJZWEpwYm5SelhDSXBPMXh1SUNBZ0lIMWNibjA3WEc1Y2JsQnliM1J2WW5WbUxuQnliM1J2ZEhsd1pTNXlaV0ZrVTFaaGNtbHVkQ0E5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUhaaGNpQnVkVzBnUFNCMGFHbHpMbkpsWVdSV1lYSnBiblFvS1R0Y2JpQWdJQ0JwWmlBb2JuVnRJRDRnTWpFME56UTRNelkwTnlrZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkVVQwUlBPaUJJWVc1a2JHVWdiblZ0WW1WeWN5QStQU0F5WGpNd0p5azdYRzRnSUNBZ0x5OGdlbWxuZW1GbklHVnVZMjlrYVc1blhHNGdJQ0FnY21WMGRYSnVJQ2dvYm5WdElENCtJREVwSUY0Z0xTaHVkVzBnSmlBeEtTazdYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVjbVZoWkZOMGNtbHVaeUE5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUhaaGNpQmllWFJsY3lBOUlIUm9hWE11Y21WaFpGWmhjbWx1ZENncE8xeHVJQ0FnSUM4dklGUlBSRTg2SUdKdmRXNWtjeUJqYUdWamEybHVaMXh1SUNBZ0lIWmhjaUJqYUhJZ1BTQlRkSEpwYm1jdVpuSnZiVU5vWVhKRGIyUmxPMXh1SUNBZ0lIWmhjaUJpSUQwZ2RHaHBjeTVpZFdZN1hHNGdJQ0FnZG1GeUlIQWdQU0IwYUdsekxuQnZjenRjYmlBZ0lDQjJZWElnWlc1a0lEMGdkR2hwY3k1d2IzTWdLeUJpZVhSbGN6dGNiaUFnSUNCMllYSWdjM1J5SUQwZ0p5YzdYRzRnSUNBZ2QyaHBiR1VnS0hBZ1BDQmxibVFwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLR0piY0YwZ1BEMGdNSGczUmlrZ2MzUnlJQ3M5SUdOb2NpaGlXM0FySzEwcE8xeHVJQ0FnSUNBZ0lDQmxiSE5sSUdsbUlDaGlXM0JkSUR3OUlEQjRRa1lwSUhSb2NtOTNJRzVsZHlCRmNuSnZjaWduU1c1MllXeHBaQ0JWVkVZdE9DQmpiMlJsY0c5cGJuUTZJQ2NnS3lCaVczQmRLVHRjYmlBZ0lDQWdJQ0FnWld4elpTQnBaaUFvWWx0d1hTQThQU0F3ZUVSR0tTQnpkSElnS3owZ1kyaHlLQ2hpVzNBcksxMGdKaUF3ZURGR0tTQThQQ0EySUh3Z0tHSmJjQ3NyWFNBbUlEQjRNMFlwS1R0Y2JpQWdJQ0FnSUNBZ1pXeHpaU0JwWmlBb1lsdHdYU0E4UFNBd2VFVkdLU0J6ZEhJZ0t6MGdZMmh5S0NoaVczQXJLMTBnSmlBd2VERkdLU0E4UENBeE1pQjhJQ2hpVzNBcksxMGdKaUF3ZUROR0tTQThQQ0EySUh3Z0tHSmJjQ3NyWFNBbUlEQjRNMFlwS1R0Y2JpQWdJQ0FnSUNBZ1pXeHpaU0JwWmlBb1lsdHdYU0E4UFNBd2VFWTNLU0J3SUNzOUlEUTdJQzh2SUZkbElHTmhiaWQwSUdoaGJtUnNaU0IwYUdWelpTQmpiMlJsY0c5cGJuUnpJR2x1SUVwVExDQnpieUJ6YTJsd0xseHVJQ0FnSUNBZ0lDQmxiSE5sSUdsbUlDaGlXM0JkSUR3OUlEQjRSa0lwSUhBZ0t6MGdOVHRjYmlBZ0lDQWdJQ0FnWld4elpTQnBaaUFvWWx0d1hTQThQU0F3ZUVaRUtTQndJQ3M5SURZN1hHNGdJQ0FnSUNBZ0lHVnNjMlVnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2RKYm5aaGJHbGtJRlZVUmkwNElHTnZaR1Z3YjJsdWREb2dKeUFySUdKYmNGMHBPMXh1SUNBZ0lIMWNiaUFnSUNCMGFHbHpMbkJ2Y3lBclBTQmllWFJsY3p0Y2JpQWdJQ0J5WlhSMWNtNGdjM1J5TzF4dWZUdGNibHh1VUhKdmRHOWlkV1l1Y0hKdmRHOTBlWEJsTG5KbFlXUkNkV1ptWlhJZ1BTQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ0lDQjJZWElnWW5sMFpYTWdQU0IwYUdsekxuSmxZV1JXWVhKcGJuUW9LVHRjYmlBZ0lDQjJZWElnWW5WbVptVnlJRDBnZEdocGN5NWlkV1l1YzNWaVlYSnlZWGtvZEdocGN5NXdiM01zSUhSb2FYTXVjRzl6SUNzZ1lubDBaWE1wTzF4dUlDQWdJSFJvYVhNdWNHOXpJQ3M5SUdKNWRHVnpPMXh1SUNBZ0lISmxkSFZ5YmlCaWRXWm1aWEk3WEc1OU8xeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1V1Y21WaFpGQmhZMnRsWkNBOUlHWjFibU4wYVc5dUtIUjVjR1VwSUh0Y2JpQWdJQ0F2THlCVVQwUlBPaUJpYjNWdVpITWdZMmhsWTJ0cGJtZGNiaUFnSUNCMllYSWdZbmwwWlhNZ1BTQjBhR2x6TG5KbFlXUldZWEpwYm5Rb0tUdGNiaUFnSUNCMllYSWdaVzVrSUQwZ2RHaHBjeTV3YjNNZ0t5QmllWFJsY3p0Y2JpQWdJQ0IyWVhJZ1lYSnlZWGtnUFNCYlhUdGNiaUFnSUNCM2FHbHNaU0FvZEdocGN5NXdiM01nUENCbGJtUXBJSHRjYmlBZ0lDQWdJQ0FnWVhKeVlYa3VjSFZ6YUNoMGFHbHpXeWR5WldGa0p5QXJJSFI1Y0dWZEtDa3BPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnWVhKeVlYazdYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVjMnRwY0NBOUlHWjFibU4wYVc5dUtIWmhiQ2tnZTF4dUlDQWdJQzh2SUZSUFJFODZJR0p2ZFc1a2N5QmphR1ZqYTJsdVoxeHVJQ0FnSUhaaGNpQjBlWEJsSUQwZ2RtRnNJQ1lnTUhnM08xeHVJQ0FnSUhOM2FYUmphQ0FvZEhsd1pTa2dlMXh1SUNBZ0lDQWdJQ0F2S2lCMllYSnBiblFnS2k4Z1kyRnpaU0JRY205MGIySjFaaTVXWVhKcGJuUTZJSGRvYVd4bElDaDBhR2x6TG1KMVpsdDBhR2x6TG5CdmN5c3JYU0ErSURCNE4yWXBPeUJpY21WaGF6dGNiaUFnSUNBZ0lDQWdMeW9nTmpRZ1ltbDBJQ292SUdOaGMyVWdVSEp2ZEc5aWRXWXVTVzUwTmpRNklIUm9hWE11Y0c5eklDczlJRGc3SUdKeVpXRnJPMXh1SUNBZ0lDQWdJQ0F2S2lCc1pXNW5kR2dnS2k4Z1kyRnpaU0JRY205MGIySjFaaTVOWlhOellXZGxPaUIyWVhJZ1lubDBaWE1nUFNCMGFHbHpMbkpsWVdSV1lYSnBiblFvS1RzZ2RHaHBjeTV3YjNNZ0t6MGdZbmwwWlhNN0lHSnlaV0ZyTzF4dUlDQWdJQ0FnSUNBdktpQXpNaUJpYVhRZ0tpOGdZMkZ6WlNCUWNtOTBiMkoxWmk1SmJuUXpNam9nZEdocGN5NXdiM01nS3owZ05Ec2dZbkpsWVdzN1hHNGdJQ0FnSUNBZ0lHUmxabUYxYkhRNklIUm9jbTkzSUc1bGR5QkZjbkp2Y2lnblZXNXBiWEJzWlcxbGJuUmxaQ0IwZVhCbE9pQW5JQ3NnZEhsd1pTazdYRzRnSUNBZ2ZWeHVmVHRjYmx4dUx5OGdQVDA5SUZkU1NWUkpUa2NnUFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQwOVBUMDlQVDA5UFQxY2JseHVVSEp2ZEc5aWRXWXVjSEp2ZEc5MGVYQmxMbmR5YVhSbFZHRm5JRDBnWm5WdVkzUnBiMjRvZEdGbkxDQjBlWEJsS1NCN1hHNGdJQ0FnZEdocGN5NTNjbWwwWlZaaGNtbHVkQ2dvZEdGbklEdzhJRE1wSUh3Z2RIbHdaU2s3WEc1OU8xeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1V1Y21WaGJHeHZZeUE5SUdaMWJtTjBhVzl1S0cxcGJpa2dlMXh1SUNBZ0lIWmhjaUJzWlc1bmRHZ2dQU0IwYUdsekxtSjFaaTVzWlc1bmRHZzdYRzRnSUNBZ2QyaHBiR1VnS0d4bGJtZDBhQ0E4SUhSb2FYTXVjRzl6SUNzZ2JXbHVLU0JzWlc1bmRHZ2dLajBnTWp0Y2JpQWdJQ0JwWmlBb2JHVnVaM1JvSUNFOUlIUm9hWE11WW5WbUxteGxibWQwYUNrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnWW5WbUlEMGdibVYzSUVKMVptWmxjaWhzWlc1bmRHZ3BPMXh1SUNBZ0lDQWdJQ0IwYUdsekxtSjFaaTVqYjNCNUtHSjFaaWs3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVZblZtSUQwZ1luVm1PMXh1SUNBZ0lIMWNibjA3WEc1Y2JsQnliM1J2WW5WbUxuQnliM1J2ZEhsd1pTNW1hVzVwYzJnZ1BTQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ0lDQnlaWFIxY200Z2RHaHBjeTVpZFdZdWMyeHBZMlVvTUN3Z2RHaHBjeTV3YjNNcE8xeHVmVHRjYmx4dVVISnZkRzlpZFdZdWNISnZkRzkwZVhCbExuZHlhWFJsVUdGamEyVmtJRDBnWm5WdVkzUnBiMjRvZEhsd1pTd2dkR0ZuTENCcGRHVnRjeWtnZTF4dUlDQWdJR2xtSUNnaGFYUmxiWE11YkdWdVozUm9LU0J5WlhSMWNtNDdYRzVjYmlBZ0lDQjJZWElnYldWemMyRm5aU0E5SUc1bGR5QlFjbTkwYjJKMVppZ3BPMXh1SUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2dhWFJsYlhNdWJHVnVaM1JvT3lCcEt5c3BJSHRjYmlBZ0lDQWdJQ0FnYldWemMyRm5aVnNuZDNKcGRHVW5JQ3NnZEhsd1pWMG9hWFJsYlhOYmFWMHBPMXh1SUNBZ0lIMWNiaUFnSUNCMllYSWdaR0YwWVNBOUlHMWxjM05oWjJVdVptbHVhWE5vS0NrN1hHNWNiaUFnSUNCMGFHbHpMbmR5YVhSbFZHRm5LSFJoWnl3Z1VISnZkRzlpZFdZdVVHRmphMlZrS1R0Y2JpQWdJQ0IwYUdsekxuZHlhWFJsUW5WbVptVnlLR1JoZEdFcE8xeHVmVHRjYmx4dVVISnZkRzlpZFdZdWNISnZkRzkwZVhCbExuZHlhWFJsVlVsdWRETXlJRDBnWm5WdVkzUnBiMjRvZG1Gc0tTQjdYRzRnSUNBZ2RHaHBjeTV5WldGc2JHOWpLRFFwTzF4dUlDQWdJSFJvYVhNdVluVm1MbmR5YVhSbFZVbHVkRE15VEVVb2RtRnNMQ0IwYUdsekxuQnZjeWs3WEc0Z0lDQWdkR2hwY3k1d2IzTWdLejBnTkR0Y2JuMDdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1M2NtbDBaVlJoWjJkbFpGVkpiblF6TWlBOUlHWjFibU4wYVc5dUtIUmhaeXdnZG1Gc0tTQjdYRzRnSUNBZ2RHaHBjeTUzY21sMFpWUmhaeWgwWVdjc0lGQnliM1J2WW5WbUxrbHVkRE15S1R0Y2JpQWdJQ0IwYUdsekxuZHlhWFJsVlVsdWRETXlLSFpoYkNrN1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWQzSnBkR1ZXWVhKcGJuUWdQU0JtZFc1amRHbHZiaWgyWVd3cElIdGNiaUFnSUNCMllXd2dQU0JPZFcxaVpYSW9kbUZzS1R0Y2JpQWdJQ0JwWmlBb2FYTk9ZVTRvZG1Gc0tTa2dlMXh1SUNBZ0lDQWdJQ0IyWVd3Z1BTQXdPMXh1SUNBZ0lIMWNibHh1SUNBZ0lHbG1JQ2gyWVd3Z1BEMGdNSGczWmlrZ2UxeHVJQ0FnSUNBZ0lDQjBhR2x6TG5KbFlXeHNiMk1vTVNrN1hHNGdJQ0FnSUNBZ0lIUm9hWE11WW5WbVczUm9hWE11Y0c5ekt5dGRJRDBnZG1Gc08xeHVJQ0FnSUgwZ1pXeHpaU0JwWmlBb2RtRnNJRHc5SURCNE0yWm1aaWtnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbkpsWVd4c2IyTW9NaWs3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVZblZtVzNSb2FYTXVjRzl6S3l0ZElEMGdNSGc0TUNCOElDZ29kbUZzSUQ0K1BpQXdLU0FtSURCNE4yWXBPMXh1SUNBZ0lDQWdJQ0IwYUdsekxtSjFabHQwYUdsekxuQnZjeXNyWFNBOUlEQjRNREFnZkNBb0tIWmhiQ0ErUGo0Z055a2dKaUF3ZURkbUtUdGNiaUFnSUNCOUlHVnNjMlVnYVdZZ0tIWmhiQ0E4UFNBd2VERm1abVptWm1ZcElIdGNiaUFnSUNBZ0lDQWdkR2hwY3k1eVpXRnNiRzlqS0RNcE8xeHVJQ0FnSUNBZ0lDQjBhR2x6TG1KMVpsdDBhR2x6TG5CdmN5c3JYU0E5SURCNE9EQWdmQ0FvS0haaGJDQStQajRnTUNrZ0ppQXdlRGRtS1R0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTVpZFdaYmRHaHBjeTV3YjNNcksxMGdQU0F3ZURnd0lId2dLQ2gyWVd3Z1BqNCtJRGNwSUNZZ01IZzNaaWs3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVZblZtVzNSb2FYTXVjRzl6S3l0ZElEMGdNSGd3TUNCOElDZ29kbUZzSUQ0K1BpQXhOQ2tnSmlBd2VEZG1LVHRjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLSFpoYkNBOFBTQXdlR1ptWm1abVptWXBJSHRjYmlBZ0lDQWdJQ0FnZEdocGN5NXlaV0ZzYkc5aktEUXBPMXh1SUNBZ0lDQWdJQ0IwYUdsekxtSjFabHQwYUdsekxuQnZjeXNyWFNBOUlEQjRPREFnZkNBb0tIWmhiQ0ErUGo0Z01Da2dKaUF3ZURkbUtUdGNiaUFnSUNBZ0lDQWdkR2hwY3k1aWRXWmJkR2hwY3k1d2IzTXJLMTBnUFNBd2VEZ3dJSHdnS0NoMllXd2dQajQrSURjcElDWWdNSGczWmlrN1hHNGdJQ0FnSUNBZ0lIUm9hWE11WW5WbVczUm9hWE11Y0c5ekt5dGRJRDBnTUhnNE1DQjhJQ2dvZG1Gc0lENCtQaUF4TkNrZ0ppQXdlRGRtS1R0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTVpZFdaYmRHaHBjeTV3YjNNcksxMGdQU0F3ZURBd0lId2dLQ2gyWVd3Z1BqNCtJREl4S1NBbUlEQjROMllwTzF4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJSGRvYVd4bElDaDJZV3dnUGlBd0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCMllYSWdZaUE5SUhaaGJDQW1JREI0TjJZN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IyWVd3Z1BTQk5ZWFJvTG1ac2IyOXlLSFpoYkNBdklERXlPQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBaaUFvZG1Gc0lENGdNQ2tnWWlCOFBTQXdlRGd3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjBhR2x6TG5KbFlXeHNiMk1vTVNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IwYUdsekxtSjFabHQwYUdsekxuQnZjeXNyWFNBOUlHSTdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQjlYRzU5TzF4dVhHNVFjbTkwYjJKMVppNXdjbTkwYjNSNWNHVXVkM0pwZEdWVVlXZG5aV1JXWVhKcGJuUWdQU0JtZFc1amRHbHZiaWgwWVdjc0lIWmhiQ2tnZTF4dUlDQWdJSFJvYVhNdWQzSnBkR1ZVWVdjb2RHRm5MQ0JRY205MGIySjFaaTVXWVhKcGJuUXBPMXh1SUNBZ0lIUm9hWE11ZDNKcGRHVldZWEpwYm5Rb2RtRnNLVHRjYm4wN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzUzY21sMFpWTldZWEpwYm5RZ1BTQm1kVzVqZEdsdmJpaDJZV3dwSUh0Y2JpQWdJQ0JwWmlBb2RtRnNJRDQ5SURBcElIdGNiaUFnSUNBZ0lDQWdkR2hwY3k1M2NtbDBaVlpoY21sdWRDaDJZV3dnS2lBeUtUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbmR5YVhSbFZtRnlhVzUwS0haaGJDQXFJQzB5SUMwZ01TazdYRzRnSUNBZ2ZWeHVmVHRjYmx4dVVISnZkRzlpZFdZdWNISnZkRzkwZVhCbExuZHlhWFJsVkdGbloyVmtVMVpoY21sdWRDQTlJR1oxYm1OMGFXOXVLSFJoWnl3Z2RtRnNLU0I3WEc0Z0lDQWdkR2hwY3k1M2NtbDBaVlJoWnloMFlXY3NJRkJ5YjNSdlluVm1MbFpoY21sdWRDazdYRzRnSUNBZ2RHaHBjeTUzY21sMFpWTldZWEpwYm5Rb2RtRnNLVHRjYm4wN1hHNWNibEJ5YjNSdlluVm1MbkJ5YjNSdmRIbHdaUzUzY21sMFpVSnZiMnhsWVc0Z1BTQm1kVzVqZEdsdmJpaDJZV3dwSUh0Y2JpQWdJQ0IwYUdsekxuZHlhWFJsVm1GeWFXNTBLRUp2YjJ4bFlXNG9kbUZzS1NrN1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWQzSnBkR1ZVWVdkblpXUkNiMjlzWldGdUlEMGdablZ1WTNScGIyNG9kR0ZuTENCMllXd3BJSHRjYmlBZ0lDQjBhR2x6TG5keWFYUmxWR0ZuWjJWa1ZtRnlhVzUwS0hSaFp5d2dRbTl2YkdWaGJpaDJZV3dwS1R0Y2JuMDdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1M2NtbDBaVk4wY21sdVp5QTlJR1oxYm1OMGFXOXVLSE4wY2lrZ2UxeHVJQ0FnSUhOMGNpQTlJRk4wY21sdVp5aHpkSElwTzF4dUlDQWdJSFpoY2lCaWVYUmxjeUE5SUVKMVptWmxjaTVpZVhSbFRHVnVaM1JvS0hOMGNpazdYRzRnSUNBZ2RHaHBjeTUzY21sMFpWWmhjbWx1ZENoaWVYUmxjeWs3WEc0Z0lDQWdkR2hwY3k1eVpXRnNiRzlqS0dKNWRHVnpLVHRjYmlBZ0lDQjBhR2x6TG1KMVppNTNjbWwwWlNoemRISXNJSFJvYVhNdWNHOXpLVHRjYmlBZ0lDQjBhR2x6TG5CdmN5QXJQU0JpZVhSbGN6dGNibjA3WEc1Y2JsQnliM1J2WW5WbUxuQnliM1J2ZEhsd1pTNTNjbWwwWlZSaFoyZGxaRk4wY21sdVp5QTlJR1oxYm1OMGFXOXVLSFJoWnl3Z2MzUnlLU0I3WEc0Z0lDQWdkR2hwY3k1M2NtbDBaVlJoWnloMFlXY3NJRkJ5YjNSdlluVm1MbE4wY21sdVp5azdYRzRnSUNBZ2RHaHBjeTUzY21sMFpWTjBjbWx1WnloemRISXBPMXh1ZlR0Y2JseHVVSEp2ZEc5aWRXWXVjSEp2ZEc5MGVYQmxMbmR5YVhSbFJteHZZWFFnUFNCbWRXNWpkR2x2YmloMllXd3BJSHRjYmlBZ0lDQjBhR2x6TG5KbFlXeHNiMk1vTkNrN1hHNGdJQ0FnZEdocGN5NWlkV1l1ZDNKcGRHVkdiRzloZEV4RktIWmhiQ3dnZEdocGN5NXdiM01wTzF4dUlDQWdJSFJvYVhNdWNHOXpJQ3M5SURRN1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWQzSnBkR1ZVWVdkblpXUkdiRzloZENBOUlHWjFibU4wYVc5dUtIUmhaeXdnZG1Gc0tTQjdYRzRnSUNBZ2RHaHBjeTUzY21sMFpWUmhaeWgwWVdjc0lGQnliM1J2WW5WbUxrbHVkRE15S1R0Y2JpQWdJQ0IwYUdsekxuZHlhWFJsUm14dllYUW9kbUZzS1R0Y2JuMDdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1M2NtbDBaVVJ2ZFdKc1pTQTlJR1oxYm1OMGFXOXVLSFpoYkNrZ2UxeHVJQ0FnSUhSb2FYTXVjbVZoYkd4dll5ZzRLVHRjYmlBZ0lDQjBhR2x6TG1KMVppNTNjbWwwWlVSdmRXSnNaVXhGS0haaGJDd2dkR2hwY3k1d2IzTXBPMXh1SUNBZ0lIUm9hWE11Y0c5eklDczlJRGc3WEc1OU8xeHVYRzVRY205MGIySjFaaTV3Y205MGIzUjVjR1V1ZDNKcGRHVlVZV2RuWldSRWIzVmliR1VnUFNCbWRXNWpkR2x2YmloMFlXY3NJSFpoYkNrZ2UxeHVJQ0FnSUhSb2FYTXVkM0pwZEdWVVlXY29kR0ZuTENCUWNtOTBiMkoxWmk1SmJuUTJOQ2s3WEc0Z0lDQWdkR2hwY3k1M2NtbDBaVVJ2ZFdKc1pTaDJZV3dwTzF4dWZUdGNibHh1VUhKdmRHOWlkV1l1Y0hKdmRHOTBlWEJsTG5keWFYUmxRblZtWm1WeUlEMGdablZ1WTNScGIyNG9ZblZtWm1WeUtTQjdYRzRnSUNBZ2RtRnlJR0o1ZEdWeklEMGdZblZtWm1WeUxteGxibWQwYUR0Y2JpQWdJQ0IwYUdsekxuZHlhWFJsVm1GeWFXNTBLR0o1ZEdWektUdGNiaUFnSUNCMGFHbHpMbkpsWVd4c2IyTW9ZbmwwWlhNcE8xeHVJQ0FnSUdKMVptWmxjaTVqYjNCNUtIUm9hWE11WW5WbUxDQjBhR2x6TG5CdmN5azdYRzRnSUNBZ2RHaHBjeTV3YjNNZ0t6MGdZbmwwWlhNN1hHNTlPMXh1WEc1UWNtOTBiMkoxWmk1d2NtOTBiM1I1Y0dVdWQzSnBkR1ZVWVdkblpXUkNkV1ptWlhJZ1BTQm1kVzVqZEdsdmJpaDBZV2NzSUdKMVptWmxjaWtnZTF4dUlDQWdJSFJvYVhNdWQzSnBkR1ZVWVdjb2RHRm5MQ0JRY205MGIySjFaaTVUZEhKcGJtY3BPMXh1SUNBZ0lIUm9hWE11ZDNKcGRHVkNkV1ptWlhJb1luVm1abVZ5S1R0Y2JuMDdYRzVjYmxCeWIzUnZZblZtTG5CeWIzUnZkSGx3WlM1M2NtbDBaVTFsYzNOaFoyVWdQU0JtZFc1amRHbHZiaWgwWVdjc0lIQnliM1J2WW5WbUtTQjdYRzRnSUNBZ2RtRnlJR0oxWm1abGNpQTlJSEJ5YjNSdlluVm1MbVpwYm1semFDZ3BPMXh1SUNBZ0lIUm9hWE11ZDNKcGRHVlVZV2NvZEdGbkxDQlFjbTkwYjJKMVppNU5aWE56WVdkbEtUdGNiaUFnSUNCMGFHbHpMbmR5YVhSbFFuVm1abVZ5S0dKMVptWmxjaWs3WEc1OU8xeHVJbDE5IiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUG9pbnQ7XG5cbmZ1bmN0aW9uIFBvaW50KHgsIHkpIHtcbiAgICB0aGlzLnggPSB4O1xuICAgIHRoaXMueSA9IHk7XG59XG5cblBvaW50LnByb3RvdHlwZSA9IHtcbiAgICBjbG9uZTogZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgUG9pbnQodGhpcy54LCB0aGlzLnkpOyB9LFxuXG4gICAgYWRkOiAgICAgZnVuY3Rpb24ocCkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9hZGQocCk7ICAgICB9LFxuICAgIHN1YjogICAgIGZ1bmN0aW9uKHApIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fc3ViKHApOyAgICAgfSxcbiAgICBtdWx0OiAgICBmdW5jdGlvbihrKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX211bHQoayk7ICAgIH0sXG4gICAgZGl2OiAgICAgZnVuY3Rpb24oaykgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9kaXYoayk7ICAgICB9LFxuICAgIHJvdGF0ZTogIGZ1bmN0aW9uKGEpIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fcm90YXRlKGEpOyAgfSxcbiAgICBtYXRNdWx0OiBmdW5jdGlvbihtKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX21hdE11bHQobSk7IH0sXG4gICAgdW5pdDogICAgZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmNsb25lKCkuX3VuaXQoKTsgfSxcbiAgICBwZXJwOiAgICBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuY2xvbmUoKS5fcGVycCgpOyB9LFxuICAgIHJvdW5kOiAgIGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5jbG9uZSgpLl9yb3VuZCgpOyB9LFxuXG4gICAgbWFnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkpO1xuICAgIH0sXG5cbiAgICBlcXVhbHM6IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCA9PT0gcC54ICYmXG4gICAgICAgICAgICAgICB0aGlzLnkgPT09IHAueTtcbiAgICB9LFxuXG4gICAgZGlzdDogZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMuZGlzdFNxcihwKSk7XG4gICAgfSxcblxuICAgIGRpc3RTcXI6IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgdmFyIGR4ID0gcC54IC0gdGhpcy54LFxuICAgICAgICAgICAgZHkgPSBwLnkgLSB0aGlzLnk7XG4gICAgICAgIHJldHVybiBkeCAqIGR4ICsgZHkgKiBkeTtcbiAgICB9LFxuXG4gICAgYW5nbGU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMih0aGlzLnksIHRoaXMueCk7XG4gICAgfSxcblxuICAgIGFuZ2xlVG86IGZ1bmN0aW9uKGIpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguYXRhbjIodGhpcy55IC0gYi55LCB0aGlzLnggLSBiLngpO1xuICAgIH0sXG5cbiAgICBhbmdsZVdpdGg6IGZ1bmN0aW9uKGIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYW5nbGVXaXRoU2VwKGIueCwgYi55KTtcbiAgICB9LFxuXG4gICAgLy8gRmluZCB0aGUgYW5nbGUgb2YgdGhlIHR3byB2ZWN0b3JzLCBzb2x2aW5nIHRoZSBmb3JtdWxhIGZvciB0aGUgY3Jvc3MgcHJvZHVjdCBhIHggYiA9IHxhfHxifHNpbijOuCkgZm9yIM64LlxuICAgIGFuZ2xlV2l0aFNlcDogZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMihcbiAgICAgICAgICAgIHRoaXMueCAqIHkgLSB0aGlzLnkgKiB4LFxuICAgICAgICAgICAgdGhpcy54ICogeCArIHRoaXMueSAqIHkpO1xuICAgIH0sXG5cbiAgICBfbWF0TXVsdDogZnVuY3Rpb24obSkge1xuICAgICAgICB2YXIgeCA9IG1bMF0gKiB0aGlzLnggKyBtWzFdICogdGhpcy55LFxuICAgICAgICAgICAgeSA9IG1bMl0gKiB0aGlzLnggKyBtWzNdICogdGhpcy55O1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgX2FkZDogZnVuY3Rpb24ocCkge1xuICAgICAgICB0aGlzLnggKz0gcC54O1xuICAgICAgICB0aGlzLnkgKz0gcC55O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgX3N1YjogZnVuY3Rpb24ocCkge1xuICAgICAgICB0aGlzLnggLT0gcC54O1xuICAgICAgICB0aGlzLnkgLT0gcC55O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgX211bHQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgdGhpcy54ICo9IGs7XG4gICAgICAgIHRoaXMueSAqPSBrO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgX2RpdjogZnVuY3Rpb24oaykge1xuICAgICAgICB0aGlzLnggLz0gaztcbiAgICAgICAgdGhpcy55IC89IGs7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfdW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuX2Rpdih0aGlzLm1hZygpKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF9wZXJwOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHkgPSB0aGlzLnk7XG4gICAgICAgIHRoaXMueSA9IHRoaXMueDtcbiAgICAgICAgdGhpcy54ID0gLXk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfcm90YXRlOiBmdW5jdGlvbihhbmdsZSkge1xuICAgICAgICB2YXIgY29zID0gTWF0aC5jb3MoYW5nbGUpLFxuICAgICAgICAgICAgc2luID0gTWF0aC5zaW4oYW5nbGUpLFxuICAgICAgICAgICAgeCA9IGNvcyAqIHRoaXMueCAtIHNpbiAqIHRoaXMueSxcbiAgICAgICAgICAgIHkgPSBzaW4gKiB0aGlzLnggKyBjb3MgKiB0aGlzLnk7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfcm91bmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnggPSBNYXRoLnJvdW5kKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucm91bmQodGhpcy55KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxuLy8gY29uc3RydWN0cyBQb2ludCBmcm9tIGFuIGFycmF5IGlmIG5lY2Vzc2FyeVxuUG9pbnQuY29udmVydCA9IGZ1bmN0aW9uIChhKSB7XG4gICAgaWYgKGEgaW5zdGFuY2VvZiBQb2ludCkge1xuICAgICAgICByZXR1cm4gYTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQb2ludChhWzBdLCBhWzFdKTtcbiAgICB9XG4gICAgcmV0dXJuIGE7XG59O1xuIiwiLypcbiAoYykgMjAxNSwgVmxhZGltaXIgQWdhZm9ua2luXG4gUkJ1c2gsIGEgSmF2YVNjcmlwdCBsaWJyYXJ5IGZvciBoaWdoLXBlcmZvcm1hbmNlIDJEIHNwYXRpYWwgaW5kZXhpbmcgb2YgcG9pbnRzIGFuZCByZWN0YW5nbGVzLlxuIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3VybmVyL3JidXNoXG4qL1xuXG4oZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHJidXNoKG1heEVudHJpZXMsIGZvcm1hdCkge1xuXG4gICAgLy8ganNoaW50IG5ld2NhcDogZmFsc2UsIHZhbGlkdGhpczogdHJ1ZVxuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiByYnVzaCkpIHJldHVybiBuZXcgcmJ1c2gobWF4RW50cmllcywgZm9ybWF0KTtcblxuICAgIC8vIG1heCBlbnRyaWVzIGluIGEgbm9kZSBpcyA5IGJ5IGRlZmF1bHQ7IG1pbiBub2RlIGZpbGwgaXMgNDAlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhpcy5fbWF4RW50cmllcyA9IE1hdGgubWF4KDQsIG1heEVudHJpZXMgfHwgOSk7XG4gICAgdGhpcy5fbWluRW50cmllcyA9IE1hdGgubWF4KDIsIE1hdGguY2VpbCh0aGlzLl9tYXhFbnRyaWVzICogMC40KSk7XG5cbiAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgIHRoaXMuX2luaXRGb3JtYXQoZm9ybWF0KTtcbiAgICB9XG5cbiAgICB0aGlzLmNsZWFyKCk7XG59XG5cbnJidXNoLnByb3RvdHlwZSA9IHtcblxuICAgIGFsbDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHRoaXMuZGF0YSwgW10pO1xuICAgIH0sXG5cbiAgICBzZWFyY2g6IGZ1bmN0aW9uIChiYm94KSB7XG5cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmRhdGEsXG4gICAgICAgICAgICByZXN1bHQgPSBbXSxcbiAgICAgICAgICAgIHRvQkJveCA9IHRoaXMudG9CQm94O1xuXG4gICAgICAgIGlmICghaW50ZXJzZWN0cyhiYm94LCBub2RlLmJib3gpKSByZXR1cm4gcmVzdWx0O1xuXG4gICAgICAgIHZhciBub2Rlc1RvU2VhcmNoID0gW10sXG4gICAgICAgICAgICBpLCBsZW4sIGNoaWxkLCBjaGlsZEJCb3g7XG5cbiAgICAgICAgd2hpbGUgKG5vZGUpIHtcbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICBjaGlsZEJCb3ggPSBub2RlLmxlYWYgPyB0b0JCb3goY2hpbGQpIDogY2hpbGQuYmJveDtcblxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnNlY3RzKGJib3gsIGNoaWxkQkJveCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUubGVhZikgcmVzdWx0LnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChjb250YWlucyhiYm94LCBjaGlsZEJCb3gpKSB0aGlzLl9hbGwoY2hpbGQsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2Ugbm9kZXNUb1NlYXJjaC5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlID0gbm9kZXNUb1NlYXJjaC5wb3AoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIGNvbGxpZGVzOiBmdW5jdGlvbiAoYmJveCkge1xuXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5kYXRhLFxuICAgICAgICAgICAgdG9CQm94ID0gdGhpcy50b0JCb3g7XG5cbiAgICAgICAgaWYgKCFpbnRlcnNlY3RzKGJib3gsIG5vZGUuYmJveCkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICB2YXIgbm9kZXNUb1NlYXJjaCA9IFtdLFxuICAgICAgICAgICAgaSwgbGVuLCBjaGlsZCwgY2hpbGRCQm94O1xuXG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgY2hpbGRCQm94ID0gbm9kZS5sZWFmID8gdG9CQm94KGNoaWxkKSA6IGNoaWxkLmJib3g7XG5cbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJzZWN0cyhiYm94LCBjaGlsZEJCb3gpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlLmxlYWYgfHwgY29udGFpbnMoYmJveCwgY2hpbGRCQm94KSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVzVG9TZWFyY2gucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbm9kZSA9IG5vZGVzVG9TZWFyY2gucG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIGxvYWQ6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICghKGRhdGEgJiYgZGF0YS5sZW5ndGgpKSByZXR1cm4gdGhpcztcblxuICAgICAgICBpZiAoZGF0YS5sZW5ndGggPCB0aGlzLl9taW5FbnRyaWVzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZGF0YS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGRhdGFbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWN1cnNpdmVseSBidWlsZCB0aGUgdHJlZSB3aXRoIHRoZSBnaXZlbiBkYXRhIGZyb20gc3RyYXRjaCB1c2luZyBPTVQgYWxnb3JpdGhtXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5fYnVpbGQoZGF0YS5zbGljZSgpLCAwLCBkYXRhLmxlbmd0aCAtIDEsIDApO1xuXG4gICAgICAgIGlmICghdGhpcy5kYXRhLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gc2F2ZSBhcyBpcyBpZiB0cmVlIGlzIGVtcHR5XG4gICAgICAgICAgICB0aGlzLmRhdGEgPSBub2RlO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5kYXRhLmhlaWdodCA9PT0gbm9kZS5oZWlnaHQpIHtcbiAgICAgICAgICAgIC8vIHNwbGl0IHJvb3QgaWYgdHJlZXMgaGF2ZSB0aGUgc2FtZSBoZWlnaHRcbiAgICAgICAgICAgIHRoaXMuX3NwbGl0Um9vdCh0aGlzLmRhdGEsIG5vZGUpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhLmhlaWdodCA8IG5vZGUuaGVpZ2h0KSB7XG4gICAgICAgICAgICAgICAgLy8gc3dhcCB0cmVlcyBpZiBpbnNlcnRlZCBvbmUgaXMgYmlnZ2VyXG4gICAgICAgICAgICAgICAgdmFyIHRtcE5vZGUgPSB0aGlzLmRhdGE7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhID0gbm9kZTtcbiAgICAgICAgICAgICAgICBub2RlID0gdG1wTm9kZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaW5zZXJ0IHRoZSBzbWFsbCB0cmVlIGludG8gdGhlIGxhcmdlIHRyZWUgYXQgYXBwcm9wcmlhdGUgbGV2ZWxcbiAgICAgICAgICAgIHRoaXMuX2luc2VydChub2RlLCB0aGlzLmRhdGEuaGVpZ2h0IC0gbm9kZS5oZWlnaHQgLSAxLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBpbnNlcnQ6IGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIGlmIChpdGVtKSB0aGlzLl9pbnNlcnQoaXRlbSwgdGhpcy5kYXRhLmhlaWdodCAtIDEpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgY2xlYXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5kYXRhID0ge1xuICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICAgICAgYmJveDogZW1wdHkoKSxcbiAgICAgICAgICAgIGxlYWY6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHJlbW92ZTogZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgaWYgKCFpdGVtKSByZXR1cm4gdGhpcztcblxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZGF0YSxcbiAgICAgICAgICAgIGJib3ggPSB0aGlzLnRvQkJveChpdGVtKSxcbiAgICAgICAgICAgIHBhdGggPSBbXSxcbiAgICAgICAgICAgIGluZGV4ZXMgPSBbXSxcbiAgICAgICAgICAgIGksIHBhcmVudCwgaW5kZXgsIGdvaW5nVXA7XG5cbiAgICAgICAgLy8gZGVwdGgtZmlyc3QgaXRlcmF0aXZlIHRyZWUgdHJhdmVyc2FsXG4gICAgICAgIHdoaWxlIChub2RlIHx8IHBhdGgubGVuZ3RoKSB7XG5cbiAgICAgICAgICAgIGlmICghbm9kZSkgeyAvLyBnbyB1cFxuICAgICAgICAgICAgICAgIG5vZGUgPSBwYXRoLnBvcCgpO1xuICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICBpID0gaW5kZXhlcy5wb3AoKTtcbiAgICAgICAgICAgICAgICBnb2luZ1VwID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5vZGUubGVhZikgeyAvLyBjaGVjayBjdXJyZW50IG5vZGVcbiAgICAgICAgICAgICAgICBpbmRleCA9IG5vZGUuY2hpbGRyZW4uaW5kZXhPZihpdGVtKTtcblxuICAgICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaXRlbSBmb3VuZCwgcmVtb3ZlIHRoZSBpdGVtIGFuZCBjb25kZW5zZSB0cmVlIHVwd2FyZHNcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICBwYXRoLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZ29pbmdVcCAmJiAhbm9kZS5sZWFmICYmIGNvbnRhaW5zKG5vZGUuYmJveCwgYmJveCkpIHsgLy8gZ28gZG93blxuICAgICAgICAgICAgICAgIHBhdGgucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgICAgICAgaSA9IDA7XG4gICAgICAgICAgICAgICAgcGFyZW50ID0gbm9kZTtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5jaGlsZHJlblswXTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXJlbnQpIHsgLy8gZ28gcmlnaHRcbiAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICAgICAgbm9kZSA9IHBhcmVudC5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICBnb2luZ1VwID0gZmFsc2U7XG5cbiAgICAgICAgICAgIH0gZWxzZSBub2RlID0gbnVsbDsgLy8gbm90aGluZyBmb3VuZFxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHRvQkJveDogZnVuY3Rpb24gKGl0ZW0pIHsgcmV0dXJuIGl0ZW07IH0sXG5cbiAgICBjb21wYXJlTWluWDogZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIGFbMF0gLSBiWzBdOyB9LFxuICAgIGNvbXBhcmVNaW5ZOiBmdW5jdGlvbiAoYSwgYikgeyByZXR1cm4gYVsxXSAtIGJbMV07IH0sXG5cbiAgICB0b0pTT046IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXMuZGF0YTsgfSxcblxuICAgIGZyb21KU09OOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgX2FsbDogZnVuY3Rpb24gKG5vZGUsIHJlc3VsdCkge1xuICAgICAgICB2YXIgbm9kZXNUb1NlYXJjaCA9IFtdO1xuICAgICAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICAgICAgaWYgKG5vZGUubGVhZikgcmVzdWx0LnB1c2guYXBwbHkocmVzdWx0LCBub2RlLmNoaWxkcmVuKTtcbiAgICAgICAgICAgIGVsc2Ugbm9kZXNUb1NlYXJjaC5wdXNoLmFwcGx5KG5vZGVzVG9TZWFyY2gsIG5vZGUuY2hpbGRyZW4pO1xuXG4gICAgICAgICAgICBub2RlID0gbm9kZXNUb1NlYXJjaC5wb3AoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICBfYnVpbGQ6IGZ1bmN0aW9uIChpdGVtcywgbGVmdCwgcmlnaHQsIGhlaWdodCkge1xuXG4gICAgICAgIHZhciBOID0gcmlnaHQgLSBsZWZ0ICsgMSxcbiAgICAgICAgICAgIE0gPSB0aGlzLl9tYXhFbnRyaWVzLFxuICAgICAgICAgICAgbm9kZTtcblxuICAgICAgICBpZiAoTiA8PSBNKSB7XG4gICAgICAgICAgICAvLyByZWFjaGVkIGxlYWYgbGV2ZWw7IHJldHVybiBsZWFmXG4gICAgICAgICAgICBub2RlID0ge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBpdGVtcy5zbGljZShsZWZ0LCByaWdodCArIDEpLFxuICAgICAgICAgICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgICAgICAgICBiYm94OiBudWxsLFxuICAgICAgICAgICAgICAgIGxlYWY6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjYWxjQkJveChub2RlLCB0aGlzLnRvQkJveCk7XG4gICAgICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaGVpZ2h0KSB7XG4gICAgICAgICAgICAvLyB0YXJnZXQgaGVpZ2h0IG9mIHRoZSBidWxrLWxvYWRlZCB0cmVlXG4gICAgICAgICAgICBoZWlnaHQgPSBNYXRoLmNlaWwoTWF0aC5sb2coTikgLyBNYXRoLmxvZyhNKSk7XG5cbiAgICAgICAgICAgIC8vIHRhcmdldCBudW1iZXIgb2Ygcm9vdCBlbnRyaWVzIHRvIG1heGltaXplIHN0b3JhZ2UgdXRpbGl6YXRpb25cbiAgICAgICAgICAgIE0gPSBNYXRoLmNlaWwoTiAvIE1hdGgucG93KE0sIGhlaWdodCAtIDEpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE8gZWxpbWluYXRlIHJlY3Vyc2lvbj9cblxuICAgICAgICBub2RlID0ge1xuICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICBiYm94OiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gc3BsaXQgdGhlIGl0ZW1zIGludG8gTSBtb3N0bHkgc3F1YXJlIHRpbGVzXG5cbiAgICAgICAgdmFyIE4yID0gTWF0aC5jZWlsKE4gLyBNKSxcbiAgICAgICAgICAgIE4xID0gTjIgKiBNYXRoLmNlaWwoTWF0aC5zcXJ0KE0pKSxcbiAgICAgICAgICAgIGksIGosIHJpZ2h0MiwgcmlnaHQzO1xuXG4gICAgICAgIG11bHRpU2VsZWN0KGl0ZW1zLCBsZWZ0LCByaWdodCwgTjEsIHRoaXMuY29tcGFyZU1pblgpO1xuXG4gICAgICAgIGZvciAoaSA9IGxlZnQ7IGkgPD0gcmlnaHQ7IGkgKz0gTjEpIHtcblxuICAgICAgICAgICAgcmlnaHQyID0gTWF0aC5taW4oaSArIE4xIC0gMSwgcmlnaHQpO1xuXG4gICAgICAgICAgICBtdWx0aVNlbGVjdChpdGVtcywgaSwgcmlnaHQyLCBOMiwgdGhpcy5jb21wYXJlTWluWSk7XG5cbiAgICAgICAgICAgIGZvciAoaiA9IGk7IGogPD0gcmlnaHQyOyBqICs9IE4yKSB7XG5cbiAgICAgICAgICAgICAgICByaWdodDMgPSBNYXRoLm1pbihqICsgTjIgLSAxLCByaWdodDIpO1xuXG4gICAgICAgICAgICAgICAgLy8gcGFjayBlYWNoIGVudHJ5IHJlY3Vyc2l2ZWx5XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5wdXNoKHRoaXMuX2J1aWxkKGl0ZW1zLCBqLCByaWdodDMsIGhlaWdodCAtIDEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGNCQm94KG5vZGUsIHRoaXMudG9CQm94KTtcblxuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9LFxuXG4gICAgX2Nob29zZVN1YnRyZWU6IGZ1bmN0aW9uIChiYm94LCBub2RlLCBsZXZlbCwgcGF0aCkge1xuXG4gICAgICAgIHZhciBpLCBsZW4sIGNoaWxkLCB0YXJnZXROb2RlLCBhcmVhLCBlbmxhcmdlbWVudCwgbWluQXJlYSwgbWluRW5sYXJnZW1lbnQ7XG5cbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIHBhdGgucHVzaChub2RlKTtcblxuICAgICAgICAgICAgaWYgKG5vZGUubGVhZiB8fCBwYXRoLmxlbmd0aCAtIDEgPT09IGxldmVsKSBicmVhaztcblxuICAgICAgICAgICAgbWluQXJlYSA9IG1pbkVubGFyZ2VtZW50ID0gSW5maW5pdHk7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgYXJlYSA9IGJib3hBcmVhKGNoaWxkLmJib3gpO1xuICAgICAgICAgICAgICAgIGVubGFyZ2VtZW50ID0gZW5sYXJnZWRBcmVhKGJib3gsIGNoaWxkLmJib3gpIC0gYXJlYTtcblxuICAgICAgICAgICAgICAgIC8vIGNob29zZSBlbnRyeSB3aXRoIHRoZSBsZWFzdCBhcmVhIGVubGFyZ2VtZW50XG4gICAgICAgICAgICAgICAgaWYgKGVubGFyZ2VtZW50IDwgbWluRW5sYXJnZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWluRW5sYXJnZW1lbnQgPSBlbmxhcmdlbWVudDtcbiAgICAgICAgICAgICAgICAgICAgbWluQXJlYSA9IGFyZWEgPCBtaW5BcmVhID8gYXJlYSA6IG1pbkFyZWE7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldE5vZGUgPSBjaGlsZDtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZW5sYXJnZW1lbnQgPT09IG1pbkVubGFyZ2VtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBjaG9vc2Ugb25lIHdpdGggdGhlIHNtYWxsZXN0IGFyZWFcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZWEgPCBtaW5BcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5BcmVhID0gYXJlYTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldE5vZGUgPSBjaGlsZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZSA9IHRhcmdldE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9LFxuXG4gICAgX2luc2VydDogZnVuY3Rpb24gKGl0ZW0sIGxldmVsLCBpc05vZGUpIHtcblxuICAgICAgICB2YXIgdG9CQm94ID0gdGhpcy50b0JCb3gsXG4gICAgICAgICAgICBiYm94ID0gaXNOb2RlID8gaXRlbS5iYm94IDogdG9CQm94KGl0ZW0pLFxuICAgICAgICAgICAgaW5zZXJ0UGF0aCA9IFtdO1xuXG4gICAgICAgIC8vIGZpbmQgdGhlIGJlc3Qgbm9kZSBmb3IgYWNjb21tb2RhdGluZyB0aGUgaXRlbSwgc2F2aW5nIGFsbCBub2RlcyBhbG9uZyB0aGUgcGF0aCB0b29cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLl9jaG9vc2VTdWJ0cmVlKGJib3gsIHRoaXMuZGF0YSwgbGV2ZWwsIGluc2VydFBhdGgpO1xuXG4gICAgICAgIC8vIHB1dCB0aGUgaXRlbSBpbnRvIHRoZSBub2RlXG4gICAgICAgIG5vZGUuY2hpbGRyZW4ucHVzaChpdGVtKTtcbiAgICAgICAgZXh0ZW5kKG5vZGUuYmJveCwgYmJveCk7XG5cbiAgICAgICAgLy8gc3BsaXQgb24gbm9kZSBvdmVyZmxvdzsgcHJvcGFnYXRlIHVwd2FyZHMgaWYgbmVjZXNzYXJ5XG4gICAgICAgIHdoaWxlIChsZXZlbCA+PSAwKSB7XG4gICAgICAgICAgICBpZiAoaW5zZXJ0UGF0aFtsZXZlbF0uY2hpbGRyZW4ubGVuZ3RoID4gdGhpcy5fbWF4RW50cmllcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NwbGl0KGluc2VydFBhdGgsIGxldmVsKTtcbiAgICAgICAgICAgICAgICBsZXZlbC0tO1xuICAgICAgICAgICAgfSBlbHNlIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRqdXN0IGJib3hlcyBhbG9uZyB0aGUgaW5zZXJ0aW9uIHBhdGhcbiAgICAgICAgdGhpcy5fYWRqdXN0UGFyZW50QkJveGVzKGJib3gsIGluc2VydFBhdGgsIGxldmVsKTtcbiAgICB9LFxuXG4gICAgLy8gc3BsaXQgb3ZlcmZsb3dlZCBub2RlIGludG8gdHdvXG4gICAgX3NwbGl0OiBmdW5jdGlvbiAoaW5zZXJ0UGF0aCwgbGV2ZWwpIHtcblxuICAgICAgICB2YXIgbm9kZSA9IGluc2VydFBhdGhbbGV2ZWxdLFxuICAgICAgICAgICAgTSA9IG5vZGUuY2hpbGRyZW4ubGVuZ3RoLFxuICAgICAgICAgICAgbSA9IHRoaXMuX21pbkVudHJpZXM7XG5cbiAgICAgICAgdGhpcy5fY2hvb3NlU3BsaXRBeGlzKG5vZGUsIG0sIE0pO1xuXG4gICAgICAgIHZhciBzcGxpdEluZGV4ID0gdGhpcy5fY2hvb3NlU3BsaXRJbmRleChub2RlLCBtLCBNKTtcblxuICAgICAgICB2YXIgbmV3Tm9kZSA9IHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBub2RlLmNoaWxkcmVuLnNwbGljZShzcGxpdEluZGV4LCBub2RlLmNoaWxkcmVuLmxlbmd0aCAtIHNwbGl0SW5kZXgpLFxuICAgICAgICAgICAgaGVpZ2h0OiBub2RlLmhlaWdodFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChub2RlLmxlYWYpIG5ld05vZGUubGVhZiA9IHRydWU7XG5cbiAgICAgICAgY2FsY0JCb3gobm9kZSwgdGhpcy50b0JCb3gpO1xuICAgICAgICBjYWxjQkJveChuZXdOb2RlLCB0aGlzLnRvQkJveCk7XG5cbiAgICAgICAgaWYgKGxldmVsKSBpbnNlcnRQYXRoW2xldmVsIC0gMV0uY2hpbGRyZW4ucHVzaChuZXdOb2RlKTtcbiAgICAgICAgZWxzZSB0aGlzLl9zcGxpdFJvb3Qobm9kZSwgbmV3Tm9kZSk7XG4gICAgfSxcblxuICAgIF9zcGxpdFJvb3Q6IGZ1bmN0aW9uIChub2RlLCBuZXdOb2RlKSB7XG4gICAgICAgIC8vIHNwbGl0IHJvb3Qgbm9kZVxuICAgICAgICB0aGlzLmRhdGEgPSB7XG4gICAgICAgICAgICBjaGlsZHJlbjogW25vZGUsIG5ld05vZGVdLFxuICAgICAgICAgICAgaGVpZ2h0OiBub2RlLmhlaWdodCArIDFcbiAgICAgICAgfTtcbiAgICAgICAgY2FsY0JCb3godGhpcy5kYXRhLCB0aGlzLnRvQkJveCk7XG4gICAgfSxcblxuICAgIF9jaG9vc2VTcGxpdEluZGV4OiBmdW5jdGlvbiAobm9kZSwgbSwgTSkge1xuXG4gICAgICAgIHZhciBpLCBiYm94MSwgYmJveDIsIG92ZXJsYXAsIGFyZWEsIG1pbk92ZXJsYXAsIG1pbkFyZWEsIGluZGV4O1xuXG4gICAgICAgIG1pbk92ZXJsYXAgPSBtaW5BcmVhID0gSW5maW5pdHk7XG5cbiAgICAgICAgZm9yIChpID0gbTsgaSA8PSBNIC0gbTsgaSsrKSB7XG4gICAgICAgICAgICBiYm94MSA9IGRpc3RCQm94KG5vZGUsIDAsIGksIHRoaXMudG9CQm94KTtcbiAgICAgICAgICAgIGJib3gyID0gZGlzdEJCb3gobm9kZSwgaSwgTSwgdGhpcy50b0JCb3gpO1xuXG4gICAgICAgICAgICBvdmVybGFwID0gaW50ZXJzZWN0aW9uQXJlYShiYm94MSwgYmJveDIpO1xuICAgICAgICAgICAgYXJlYSA9IGJib3hBcmVhKGJib3gxKSArIGJib3hBcmVhKGJib3gyKTtcblxuICAgICAgICAgICAgLy8gY2hvb3NlIGRpc3RyaWJ1dGlvbiB3aXRoIG1pbmltdW0gb3ZlcmxhcFxuICAgICAgICAgICAgaWYgKG92ZXJsYXAgPCBtaW5PdmVybGFwKSB7XG4gICAgICAgICAgICAgICAgbWluT3ZlcmxhcCA9IG92ZXJsYXA7XG4gICAgICAgICAgICAgICAgaW5kZXggPSBpO1xuXG4gICAgICAgICAgICAgICAgbWluQXJlYSA9IGFyZWEgPCBtaW5BcmVhID8gYXJlYSA6IG1pbkFyZWE7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3ZlcmxhcCA9PT0gbWluT3ZlcmxhcCkge1xuICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBjaG9vc2UgZGlzdHJpYnV0aW9uIHdpdGggbWluaW11bSBhcmVhXG4gICAgICAgICAgICAgICAgaWYgKGFyZWEgPCBtaW5BcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbkFyZWEgPSBhcmVhO1xuICAgICAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgIH0sXG5cbiAgICAvLyBzb3J0cyBub2RlIGNoaWxkcmVuIGJ5IHRoZSBiZXN0IGF4aXMgZm9yIHNwbGl0XG4gICAgX2Nob29zZVNwbGl0QXhpczogZnVuY3Rpb24gKG5vZGUsIG0sIE0pIHtcblxuICAgICAgICB2YXIgY29tcGFyZU1pblggPSBub2RlLmxlYWYgPyB0aGlzLmNvbXBhcmVNaW5YIDogY29tcGFyZU5vZGVNaW5YLFxuICAgICAgICAgICAgY29tcGFyZU1pblkgPSBub2RlLmxlYWYgPyB0aGlzLmNvbXBhcmVNaW5ZIDogY29tcGFyZU5vZGVNaW5ZLFxuICAgICAgICAgICAgeE1hcmdpbiA9IHRoaXMuX2FsbERpc3RNYXJnaW4obm9kZSwgbSwgTSwgY29tcGFyZU1pblgpLFxuICAgICAgICAgICAgeU1hcmdpbiA9IHRoaXMuX2FsbERpc3RNYXJnaW4obm9kZSwgbSwgTSwgY29tcGFyZU1pblkpO1xuXG4gICAgICAgIC8vIGlmIHRvdGFsIGRpc3RyaWJ1dGlvbnMgbWFyZ2luIHZhbHVlIGlzIG1pbmltYWwgZm9yIHgsIHNvcnQgYnkgbWluWCxcbiAgICAgICAgLy8gb3RoZXJ3aXNlIGl0J3MgYWxyZWFkeSBzb3J0ZWQgYnkgbWluWVxuICAgICAgICBpZiAoeE1hcmdpbiA8IHlNYXJnaW4pIG5vZGUuY2hpbGRyZW4uc29ydChjb21wYXJlTWluWCk7XG4gICAgfSxcblxuICAgIC8vIHRvdGFsIG1hcmdpbiBvZiBhbGwgcG9zc2libGUgc3BsaXQgZGlzdHJpYnV0aW9ucyB3aGVyZSBlYWNoIG5vZGUgaXMgYXQgbGVhc3QgbSBmdWxsXG4gICAgX2FsbERpc3RNYXJnaW46IGZ1bmN0aW9uIChub2RlLCBtLCBNLCBjb21wYXJlKSB7XG5cbiAgICAgICAgbm9kZS5jaGlsZHJlbi5zb3J0KGNvbXBhcmUpO1xuXG4gICAgICAgIHZhciB0b0JCb3ggPSB0aGlzLnRvQkJveCxcbiAgICAgICAgICAgIGxlZnRCQm94ID0gZGlzdEJCb3gobm9kZSwgMCwgbSwgdG9CQm94KSxcbiAgICAgICAgICAgIHJpZ2h0QkJveCA9IGRpc3RCQm94KG5vZGUsIE0gLSBtLCBNLCB0b0JCb3gpLFxuICAgICAgICAgICAgbWFyZ2luID0gYmJveE1hcmdpbihsZWZ0QkJveCkgKyBiYm94TWFyZ2luKHJpZ2h0QkJveCksXG4gICAgICAgICAgICBpLCBjaGlsZDtcblxuICAgICAgICBmb3IgKGkgPSBtOyBpIDwgTSAtIG07IGkrKykge1xuICAgICAgICAgICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgZXh0ZW5kKGxlZnRCQm94LCBub2RlLmxlYWYgPyB0b0JCb3goY2hpbGQpIDogY2hpbGQuYmJveCk7XG4gICAgICAgICAgICBtYXJnaW4gKz0gYmJveE1hcmdpbihsZWZ0QkJveCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGkgPSBNIC0gbSAtIDE7IGkgPj0gbTsgaS0tKSB7XG4gICAgICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgICAgICBleHRlbmQocmlnaHRCQm94LCBub2RlLmxlYWYgPyB0b0JCb3goY2hpbGQpIDogY2hpbGQuYmJveCk7XG4gICAgICAgICAgICBtYXJnaW4gKz0gYmJveE1hcmdpbihyaWdodEJCb3gpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1hcmdpbjtcbiAgICB9LFxuXG4gICAgX2FkanVzdFBhcmVudEJCb3hlczogZnVuY3Rpb24gKGJib3gsIHBhdGgsIGxldmVsKSB7XG4gICAgICAgIC8vIGFkanVzdCBiYm94ZXMgYWxvbmcgdGhlIGdpdmVuIHRyZWUgcGF0aFxuICAgICAgICBmb3IgKHZhciBpID0gbGV2ZWw7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBleHRlbmQocGF0aFtpXS5iYm94LCBiYm94KTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfY29uZGVuc2U6IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgIC8vIGdvIHRocm91Z2ggdGhlIHBhdGgsIHJlbW92aW5nIGVtcHR5IG5vZGVzIGFuZCB1cGRhdGluZyBiYm94ZXNcbiAgICAgICAgZm9yICh2YXIgaSA9IHBhdGgubGVuZ3RoIC0gMSwgc2libGluZ3M7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBpZiAocGF0aFtpXS5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgc2libGluZ3MgPSBwYXRoW2kgLSAxXS5jaGlsZHJlbjtcbiAgICAgICAgICAgICAgICAgICAgc2libGluZ3Muc3BsaWNlKHNpYmxpbmdzLmluZGV4T2YocGF0aFtpXSksIDEpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHRoaXMuY2xlYXIoKTtcblxuICAgICAgICAgICAgfSBlbHNlIGNhbGNCQm94KHBhdGhbaV0sIHRoaXMudG9CQm94KTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfaW5pdEZvcm1hdDogZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgICAgICAvLyBkYXRhIGZvcm1hdCAobWluWCwgbWluWSwgbWF4WCwgbWF4WSBhY2Nlc3NvcnMpXG5cbiAgICAgICAgLy8gdXNlcyBldmFsLXR5cGUgZnVuY3Rpb24gY29tcGlsYXRpb24gaW5zdGVhZCBvZiBqdXN0IGFjY2VwdGluZyBhIHRvQkJveCBmdW5jdGlvblxuICAgICAgICAvLyBiZWNhdXNlIHRoZSBhbGdvcml0aG1zIGFyZSB2ZXJ5IHNlbnNpdGl2ZSB0byBzb3J0aW5nIGZ1bmN0aW9ucyBwZXJmb3JtYW5jZSxcbiAgICAgICAgLy8gc28gdGhleSBzaG91bGQgYmUgZGVhZCBzaW1wbGUgYW5kIHdpdGhvdXQgaW5uZXIgY2FsbHNcblxuICAgICAgICAvLyBqc2hpbnQgZXZpbDogdHJ1ZVxuXG4gICAgICAgIHZhciBjb21wYXJlQXJyID0gWydyZXR1cm4gYScsICcgLSBiJywgJzsnXTtcblxuICAgICAgICB0aGlzLmNvbXBhcmVNaW5YID0gbmV3IEZ1bmN0aW9uKCdhJywgJ2InLCBjb21wYXJlQXJyLmpvaW4oZm9ybWF0WzBdKSk7XG4gICAgICAgIHRoaXMuY29tcGFyZU1pblkgPSBuZXcgRnVuY3Rpb24oJ2EnLCAnYicsIGNvbXBhcmVBcnIuam9pbihmb3JtYXRbMV0pKTtcblxuICAgICAgICB0aGlzLnRvQkJveCA9IG5ldyBGdW5jdGlvbignYScsICdyZXR1cm4gW2EnICsgZm9ybWF0LmpvaW4oJywgYScpICsgJ107Jyk7XG4gICAgfVxufTtcblxuXG4vLyBjYWxjdWxhdGUgbm9kZSdzIGJib3ggZnJvbSBiYm94ZXMgb2YgaXRzIGNoaWxkcmVuXG5mdW5jdGlvbiBjYWxjQkJveChub2RlLCB0b0JCb3gpIHtcbiAgICBub2RlLmJib3ggPSBkaXN0QkJveChub2RlLCAwLCBub2RlLmNoaWxkcmVuLmxlbmd0aCwgdG9CQm94KTtcbn1cblxuLy8gbWluIGJvdW5kaW5nIHJlY3RhbmdsZSBvZiBub2RlIGNoaWxkcmVuIGZyb20gayB0byBwLTFcbmZ1bmN0aW9uIGRpc3RCQm94KG5vZGUsIGssIHAsIHRvQkJveCkge1xuICAgIHZhciBiYm94ID0gZW1wdHkoKTtcblxuICAgIGZvciAodmFyIGkgPSBrLCBjaGlsZDsgaSA8IHA7IGkrKykge1xuICAgICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICAgIGV4dGVuZChiYm94LCBub2RlLmxlYWYgPyB0b0JCb3goY2hpbGQpIDogY2hpbGQuYmJveCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJib3g7XG59XG5cbmZ1bmN0aW9uIGVtcHR5KCkgeyByZXR1cm4gW0luZmluaXR5LCBJbmZpbml0eSwgLUluZmluaXR5LCAtSW5maW5pdHldOyB9XG5cbmZ1bmN0aW9uIGV4dGVuZChhLCBiKSB7XG4gICAgYVswXSA9IE1hdGgubWluKGFbMF0sIGJbMF0pO1xuICAgIGFbMV0gPSBNYXRoLm1pbihhWzFdLCBiWzFdKTtcbiAgICBhWzJdID0gTWF0aC5tYXgoYVsyXSwgYlsyXSk7XG4gICAgYVszXSA9IE1hdGgubWF4KGFbM10sIGJbM10pO1xuICAgIHJldHVybiBhO1xufVxuXG5mdW5jdGlvbiBjb21wYXJlTm9kZU1pblgoYSwgYikgeyByZXR1cm4gYS5iYm94WzBdIC0gYi5iYm94WzBdOyB9XG5mdW5jdGlvbiBjb21wYXJlTm9kZU1pblkoYSwgYikgeyByZXR1cm4gYS5iYm94WzFdIC0gYi5iYm94WzFdOyB9XG5cbmZ1bmN0aW9uIGJib3hBcmVhKGEpICAgeyByZXR1cm4gKGFbMl0gLSBhWzBdKSAqIChhWzNdIC0gYVsxXSk7IH1cbmZ1bmN0aW9uIGJib3hNYXJnaW4oYSkgeyByZXR1cm4gKGFbMl0gLSBhWzBdKSArIChhWzNdIC0gYVsxXSk7IH1cblxuZnVuY3Rpb24gZW5sYXJnZWRBcmVhKGEsIGIpIHtcbiAgICByZXR1cm4gKE1hdGgubWF4KGJbMl0sIGFbMl0pIC0gTWF0aC5taW4oYlswXSwgYVswXSkpICpcbiAgICAgICAgICAgKE1hdGgubWF4KGJbM10sIGFbM10pIC0gTWF0aC5taW4oYlsxXSwgYVsxXSkpO1xufVxuXG5mdW5jdGlvbiBpbnRlcnNlY3Rpb25BcmVhKGEsIGIpIHtcbiAgICB2YXIgbWluWCA9IE1hdGgubWF4KGFbMF0sIGJbMF0pLFxuICAgICAgICBtaW5ZID0gTWF0aC5tYXgoYVsxXSwgYlsxXSksXG4gICAgICAgIG1heFggPSBNYXRoLm1pbihhWzJdLCBiWzJdKSxcbiAgICAgICAgbWF4WSA9IE1hdGgubWluKGFbM10sIGJbM10pO1xuXG4gICAgcmV0dXJuIE1hdGgubWF4KDAsIG1heFggLSBtaW5YKSAqXG4gICAgICAgICAgIE1hdGgubWF4KDAsIG1heFkgLSBtaW5ZKTtcbn1cblxuZnVuY3Rpb24gY29udGFpbnMoYSwgYikge1xuICAgIHJldHVybiBhWzBdIDw9IGJbMF0gJiZcbiAgICAgICAgICAgYVsxXSA8PSBiWzFdICYmXG4gICAgICAgICAgIGJbMl0gPD0gYVsyXSAmJlxuICAgICAgICAgICBiWzNdIDw9IGFbM107XG59XG5cbmZ1bmN0aW9uIGludGVyc2VjdHMoYSwgYikge1xuICAgIHJldHVybiBiWzBdIDw9IGFbMl0gJiZcbiAgICAgICAgICAgYlsxXSA8PSBhWzNdICYmXG4gICAgICAgICAgIGJbMl0gPj0gYVswXSAmJlxuICAgICAgICAgICBiWzNdID49IGFbMV07XG59XG5cbi8vIHNvcnQgYW4gYXJyYXkgc28gdGhhdCBpdGVtcyBjb21lIGluIGdyb3VwcyBvZiBuIHVuc29ydGVkIGl0ZW1zLCB3aXRoIGdyb3VwcyBzb3J0ZWQgYmV0d2VlbiBlYWNoIG90aGVyO1xuLy8gY29tYmluZXMgc2VsZWN0aW9uIGFsZ29yaXRobSB3aXRoIGJpbmFyeSBkaXZpZGUgJiBjb25xdWVyIGFwcHJvYWNoXG5cbmZ1bmN0aW9uIG11bHRpU2VsZWN0KGFyciwgbGVmdCwgcmlnaHQsIG4sIGNvbXBhcmUpIHtcbiAgICB2YXIgc3RhY2sgPSBbbGVmdCwgcmlnaHRdLFxuICAgICAgICBtaWQ7XG5cbiAgICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgICAgIHJpZ2h0ID0gc3RhY2sucG9wKCk7XG4gICAgICAgIGxlZnQgPSBzdGFjay5wb3AoKTtcblxuICAgICAgICBpZiAocmlnaHQgLSBsZWZ0IDw9IG4pIGNvbnRpbnVlO1xuXG4gICAgICAgIG1pZCA9IGxlZnQgKyBNYXRoLmNlaWwoKHJpZ2h0IC0gbGVmdCkgLyBuIC8gMikgKiBuO1xuICAgICAgICBzZWxlY3QoYXJyLCBsZWZ0LCByaWdodCwgbWlkLCBjb21wYXJlKTtcblxuICAgICAgICBzdGFjay5wdXNoKGxlZnQsIG1pZCwgbWlkLCByaWdodCk7XG4gICAgfVxufVxuXG4vLyBGbG95ZC1SaXZlc3Qgc2VsZWN0aW9uIGFsZ29yaXRobTpcbi8vIHNvcnQgYW4gYXJyYXkgYmV0d2VlbiBsZWZ0IGFuZCByaWdodCAoaW5jbHVzaXZlKSBzbyB0aGF0IHRoZSBzbWFsbGVzdCBrIGVsZW1lbnRzIGNvbWUgZmlyc3QgKHVub3JkZXJlZClcbmZ1bmN0aW9uIHNlbGVjdChhcnIsIGxlZnQsIHJpZ2h0LCBrLCBjb21wYXJlKSB7XG4gICAgdmFyIG4sIGksIHosIHMsIHNkLCBuZXdMZWZ0LCBuZXdSaWdodCwgdCwgajtcblxuICAgIHdoaWxlIChyaWdodCA+IGxlZnQpIHtcbiAgICAgICAgaWYgKHJpZ2h0IC0gbGVmdCA+IDYwMCkge1xuICAgICAgICAgICAgbiA9IHJpZ2h0IC0gbGVmdCArIDE7XG4gICAgICAgICAgICBpID0gayAtIGxlZnQgKyAxO1xuICAgICAgICAgICAgeiA9IE1hdGgubG9nKG4pO1xuICAgICAgICAgICAgcyA9IDAuNSAqIE1hdGguZXhwKDIgKiB6IC8gMyk7XG4gICAgICAgICAgICBzZCA9IDAuNSAqIE1hdGguc3FydCh6ICogcyAqIChuIC0gcykgLyBuKSAqIChpIC0gbiAvIDIgPCAwID8gLTEgOiAxKTtcbiAgICAgICAgICAgIG5ld0xlZnQgPSBNYXRoLm1heChsZWZ0LCBNYXRoLmZsb29yKGsgLSBpICogcyAvIG4gKyBzZCkpO1xuICAgICAgICAgICAgbmV3UmlnaHQgPSBNYXRoLm1pbihyaWdodCwgTWF0aC5mbG9vcihrICsgKG4gLSBpKSAqIHMgLyBuICsgc2QpKTtcbiAgICAgICAgICAgIHNlbGVjdChhcnIsIG5ld0xlZnQsIG5ld1JpZ2h0LCBrLCBjb21wYXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHQgPSBhcnJba107XG4gICAgICAgIGkgPSBsZWZ0O1xuICAgICAgICBqID0gcmlnaHQ7XG5cbiAgICAgICAgc3dhcChhcnIsIGxlZnQsIGspO1xuICAgICAgICBpZiAoY29tcGFyZShhcnJbcmlnaHRdLCB0KSA+IDApIHN3YXAoYXJyLCBsZWZ0LCByaWdodCk7XG5cbiAgICAgICAgd2hpbGUgKGkgPCBqKSB7XG4gICAgICAgICAgICBzd2FwKGFyciwgaSwgaik7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBqLS07XG4gICAgICAgICAgICB3aGlsZSAoY29tcGFyZShhcnJbaV0sIHQpIDwgMCkgaSsrO1xuICAgICAgICAgICAgd2hpbGUgKGNvbXBhcmUoYXJyW2pdLCB0KSA+IDApIGotLTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb21wYXJlKGFycltsZWZ0XSwgdCkgPT09IDApIHN3YXAoYXJyLCBsZWZ0LCBqKTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBqKys7XG4gICAgICAgICAgICBzd2FwKGFyciwgaiwgcmlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGogPD0gaykgbGVmdCA9IGogKyAxO1xuICAgICAgICBpZiAoayA8PSBqKSByaWdodCA9IGogLSAxO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc3dhcChhcnIsIGksIGopIHtcbiAgICB2YXIgdG1wID0gYXJyW2ldO1xuICAgIGFycltpXSA9IGFycltqXTtcbiAgICBhcnJbal0gPSB0bXA7XG59XG5cblxuLy8gZXhwb3J0IGFzIEFNRC9Db21tb25KUyBtb2R1bGUgb3IgZ2xvYmFsIHZhcmlhYmxlXG5pZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSBkZWZpbmUoJ3JidXNoJywgZnVuY3Rpb24oKSB7IHJldHVybiByYnVzaDsgfSk7XG5lbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSByYnVzaDtcbmVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykgc2VsZi5yYnVzaCA9IHJidXNoO1xuZWxzZSB3aW5kb3cucmJ1c2ggPSByYnVzaDtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzLlZlY3RvclRpbGUgPSByZXF1aXJlKCcuL2xpYi92ZWN0b3J0aWxlLmpzJyk7XG5tb2R1bGUuZXhwb3J0cy5WZWN0b3JUaWxlRmVhdHVyZSA9IHJlcXVpcmUoJy4vbGliL3ZlY3RvcnRpbGVmZWF0dXJlLmpzJyk7XG5tb2R1bGUuZXhwb3J0cy5WZWN0b3JUaWxlTGF5ZXIgPSByZXF1aXJlKCcuL2xpYi92ZWN0b3J0aWxlbGF5ZXIuanMnKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFZlY3RvclRpbGVMYXllciA9IHJlcXVpcmUoJy4vdmVjdG9ydGlsZWxheWVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gVmVjdG9yVGlsZTtcblxuZnVuY3Rpb24gVmVjdG9yVGlsZShidWZmZXIsIGVuZCkge1xuXG4gICAgdGhpcy5sYXllcnMgPSB7fTtcbiAgICB0aGlzLl9idWZmZXIgPSBidWZmZXI7XG5cbiAgICBlbmQgPSBlbmQgfHwgYnVmZmVyLmxlbmd0aDtcblxuICAgIHdoaWxlIChidWZmZXIucG9zIDwgZW5kKSB7XG4gICAgICAgIHZhciB2YWwgPSBidWZmZXIucmVhZFZhcmludCgpLFxuICAgICAgICAgICAgdGFnID0gdmFsID4+IDM7XG5cbiAgICAgICAgaWYgKHRhZyA9PSAzKSB7XG4gICAgICAgICAgICB2YXIgbGF5ZXIgPSB0aGlzLnJlYWRMYXllcigpO1xuICAgICAgICAgICAgaWYgKGxheWVyLmxlbmd0aCkgdGhpcy5sYXllcnNbbGF5ZXIubmFtZV0gPSBsYXllcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ1ZmZlci5za2lwKHZhbCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblZlY3RvclRpbGUucHJvdG90eXBlLnJlYWRMYXllciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBidWZmZXIgPSB0aGlzLl9idWZmZXIsXG4gICAgICAgIGJ5dGVzID0gYnVmZmVyLnJlYWRWYXJpbnQoKSxcbiAgICAgICAgZW5kID0gYnVmZmVyLnBvcyArIGJ5dGVzLFxuICAgICAgICBsYXllciA9IG5ldyBWZWN0b3JUaWxlTGF5ZXIoYnVmZmVyLCBlbmQpO1xuXG4gICAgYnVmZmVyLnBvcyA9IGVuZDtcblxuICAgIHJldHVybiBsYXllcjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQb2ludCA9IHJlcXVpcmUoJ3BvaW50LWdlb21ldHJ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gVmVjdG9yVGlsZUZlYXR1cmU7XG5cbmZ1bmN0aW9uIFZlY3RvclRpbGVGZWF0dXJlKGJ1ZmZlciwgZW5kLCBleHRlbnQsIGtleXMsIHZhbHVlcykge1xuXG4gICAgdGhpcy5wcm9wZXJ0aWVzID0ge307XG5cbiAgICAvLyBQdWJsaWNcbiAgICB0aGlzLmV4dGVudCA9IGV4dGVudDtcbiAgICB0aGlzLnR5cGUgPSAwO1xuXG4gICAgLy8gUHJpdmF0ZVxuICAgIHRoaXMuX2J1ZmZlciA9IGJ1ZmZlcjtcbiAgICB0aGlzLl9nZW9tZXRyeSA9IC0xO1xuXG4gICAgZW5kID0gZW5kIHx8IGJ1ZmZlci5sZW5ndGg7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICB2YXIgdmFsID0gYnVmZmVyLnJlYWRWYXJpbnQoKSxcbiAgICAgICAgICAgIHRhZyA9IHZhbCA+PiAzO1xuXG4gICAgICAgIGlmICh0YWcgPT0gMSkge1xuICAgICAgICAgICAgdGhpcy5faWQgPSBidWZmZXIucmVhZFZhcmludCgpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09IDIpIHtcbiAgICAgICAgICAgIHZhciB0YWdMZW4gPSBidWZmZXIucmVhZFZhcmludCgpLFxuICAgICAgICAgICAgICAgIHRhZ0VuZCA9IGJ1ZmZlci5wb3MgKyB0YWdMZW47XG5cbiAgICAgICAgICAgIHdoaWxlIChidWZmZXIucG9zIDwgdGFnRW5kKSB7XG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbYnVmZmVyLnJlYWRWYXJpbnQoKV07XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gdmFsdWVzW2J1ZmZlci5yZWFkVmFyaW50KCldO1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcGVydGllc1trZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gMykge1xuICAgICAgICAgICAgdGhpcy50eXBlID0gYnVmZmVyLnJlYWRWYXJpbnQoKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA0KSB7XG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeSA9IGJ1ZmZlci5wb3M7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5WZWN0b3JUaWxlRmVhdHVyZS50eXBlcyA9IFsnVW5rbm93bicsICdQb2ludCcsICdMaW5lU3RyaW5nJywgJ1BvbHlnb24nXTtcblxuVmVjdG9yVGlsZUZlYXR1cmUucHJvdG90eXBlLmxvYWRHZW9tZXRyeSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBidWZmZXIgPSB0aGlzLl9idWZmZXI7XG4gICAgYnVmZmVyLnBvcyA9IHRoaXMuX2dlb21ldHJ5O1xuXG4gICAgdmFyIGJ5dGVzID0gYnVmZmVyLnJlYWRWYXJpbnQoKSxcbiAgICAgICAgZW5kID0gYnVmZmVyLnBvcyArIGJ5dGVzLFxuICAgICAgICBjbWQgPSAxLFxuICAgICAgICBsZW5ndGggPSAwLFxuICAgICAgICB4ID0gMCxcbiAgICAgICAgeSA9IDAsXG4gICAgICAgIGxpbmVzID0gW10sXG4gICAgICAgIGxpbmU7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGNtZF9sZW5ndGggPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICAgICAgY21kID0gY21kX2xlbmd0aCAmIDB4NztcbiAgICAgICAgICAgIGxlbmd0aCA9IGNtZF9sZW5ndGggPj4gMztcbiAgICAgICAgfVxuXG4gICAgICAgIGxlbmd0aC0tO1xuXG4gICAgICAgIGlmIChjbWQgPT09IDEgfHwgY21kID09PSAyKSB7XG4gICAgICAgICAgICB4ICs9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuICAgICAgICAgICAgeSArPSBidWZmZXIucmVhZFNWYXJpbnQoKTtcblxuICAgICAgICAgICAgaWYgKGNtZCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIC8vIG1vdmVUb1xuICAgICAgICAgICAgICAgIGlmIChsaW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpbmVzLnB1c2gobGluZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxpbmUgPSBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGluZS5wdXNoKG5ldyBQb2ludCh4LCB5KSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY21kID09PSA3KSB7XG4gICAgICAgICAgICAvLyBjbG9zZVBvbHlnb25cbiAgICAgICAgICAgIGxpbmUucHVzaChsaW5lWzBdLmNsb25lKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIGNvbW1hbmQgJyArIGNtZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGluZSkgbGluZXMucHVzaChsaW5lKTtcblxuICAgIHJldHVybiBsaW5lcztcbn07XG5cblZlY3RvclRpbGVGZWF0dXJlLnByb3RvdHlwZS5iYm94ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcjtcbiAgICBidWZmZXIucG9zID0gdGhpcy5fZ2VvbWV0cnk7XG5cbiAgICB2YXIgYnl0ZXMgPSBidWZmZXIucmVhZFZhcmludCgpLFxuICAgICAgICBlbmQgPSBidWZmZXIucG9zICsgYnl0ZXMsXG5cbiAgICAgICAgY21kID0gMSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgeCA9IDAsXG4gICAgICAgIHkgPSAwLFxuICAgICAgICB4MSA9IEluZmluaXR5LFxuICAgICAgICB4MiA9IC1JbmZpbml0eSxcbiAgICAgICAgeTEgPSBJbmZpbml0eSxcbiAgICAgICAgeTIgPSAtSW5maW5pdHk7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGNtZF9sZW5ndGggPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICAgICAgY21kID0gY21kX2xlbmd0aCAmIDB4NztcbiAgICAgICAgICAgIGxlbmd0aCA9IGNtZF9sZW5ndGggPj4gMztcbiAgICAgICAgfVxuXG4gICAgICAgIGxlbmd0aC0tO1xuXG4gICAgICAgIGlmIChjbWQgPT09IDEgfHwgY21kID09PSAyKSB7XG4gICAgICAgICAgICB4ICs9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuICAgICAgICAgICAgeSArPSBidWZmZXIucmVhZFNWYXJpbnQoKTtcbiAgICAgICAgICAgIGlmICh4IDwgeDEpIHgxID0geDtcbiAgICAgICAgICAgIGlmICh4ID4geDIpIHgyID0geDtcbiAgICAgICAgICAgIGlmICh5IDwgeTEpIHkxID0geTtcbiAgICAgICAgICAgIGlmICh5ID4geTIpIHkyID0geTtcblxuICAgICAgICB9IGVsc2UgaWYgKGNtZCAhPT0gNykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIGNvbW1hbmQgJyArIGNtZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gW3gxLCB5MSwgeDIsIHkyXTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBWZWN0b3JUaWxlRmVhdHVyZSA9IHJlcXVpcmUoJy4vdmVjdG9ydGlsZWZlYXR1cmUuanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBWZWN0b3JUaWxlTGF5ZXI7XG5mdW5jdGlvbiBWZWN0b3JUaWxlTGF5ZXIoYnVmZmVyLCBlbmQpIHtcbiAgICAvLyBQdWJsaWNcbiAgICB0aGlzLnZlcnNpb24gPSAxO1xuICAgIHRoaXMubmFtZSA9IG51bGw7XG4gICAgdGhpcy5leHRlbnQgPSA0MDk2O1xuICAgIHRoaXMubGVuZ3RoID0gMDtcblxuICAgIC8vIFByaXZhdGVcbiAgICB0aGlzLl9idWZmZXIgPSBidWZmZXI7XG4gICAgdGhpcy5fa2V5cyA9IFtdO1xuICAgIHRoaXMuX3ZhbHVlcyA9IFtdO1xuICAgIHRoaXMuX2ZlYXR1cmVzID0gW107XG5cbiAgICB2YXIgdmFsLCB0YWc7XG5cbiAgICBlbmQgPSBlbmQgfHwgYnVmZmVyLmxlbmd0aDtcblxuICAgIHdoaWxlIChidWZmZXIucG9zIDwgZW5kKSB7XG4gICAgICAgIHZhbCA9IGJ1ZmZlci5yZWFkVmFyaW50KCk7XG4gICAgICAgIHRhZyA9IHZhbCA+PiAzO1xuXG4gICAgICAgIGlmICh0YWcgPT09IDE1KSB7XG4gICAgICAgICAgICB0aGlzLnZlcnNpb24gPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5uYW1lID0gYnVmZmVyLnJlYWRTdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT09IDUpIHtcbiAgICAgICAgICAgIHRoaXMuZXh0ZW50ID0gYnVmZmVyLnJlYWRWYXJpbnQoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT09IDIpIHtcbiAgICAgICAgICAgIHRoaXMubGVuZ3RoKys7XG4gICAgICAgICAgICB0aGlzLl9mZWF0dXJlcy5wdXNoKGJ1ZmZlci5wb3MpO1xuICAgICAgICAgICAgYnVmZmVyLnNraXAodmFsKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMykge1xuICAgICAgICAgICAgdGhpcy5fa2V5cy5wdXNoKGJ1ZmZlci5yZWFkU3RyaW5nKCkpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gNCkge1xuICAgICAgICAgICAgdGhpcy5fdmFsdWVzLnB1c2godGhpcy5yZWFkRmVhdHVyZVZhbHVlKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnVmZmVyLnNraXAodmFsKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuVmVjdG9yVGlsZUxheWVyLnByb3RvdHlwZS5yZWFkRmVhdHVyZVZhbHVlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuX2J1ZmZlcixcbiAgICAgICAgdmFsdWUgPSBudWxsLFxuICAgICAgICBieXRlcyA9IGJ1ZmZlci5yZWFkVmFyaW50KCksXG4gICAgICAgIGVuZCA9IGJ1ZmZlci5wb3MgKyBieXRlcyxcbiAgICAgICAgdmFsLCB0YWc7XG5cbiAgICB3aGlsZSAoYnVmZmVyLnBvcyA8IGVuZCkge1xuICAgICAgICB2YWwgPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICB0YWcgPSB2YWwgPj4gMztcblxuICAgICAgICBpZiAodGFnID09IDEpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYnVmZmVyLnJlYWRTdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gMikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZWFkIGZsb2F0Jyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnID09IDMpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYnVmZmVyLnJlYWREb3VibGUoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT0gNCkge1xuICAgICAgICAgICAgdmFsdWUgPSBidWZmZXIucmVhZFZhcmludCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA1KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlYWQgdWludCcpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA2KSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGJ1ZmZlci5yZWFkU1ZhcmludCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PSA3KSB7XG4gICAgICAgICAgICB2YWx1ZSA9IEJvb2xlYW4oYnVmZmVyLnJlYWRWYXJpbnQoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWZmZXIuc2tpcCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gcmV0dXJuIGZlYXR1cmUgYGlgIGZyb20gdGhpcyBsYXllciBhcyBhIGBWZWN0b3JUaWxlRmVhdHVyZWBcblZlY3RvclRpbGVMYXllci5wcm90b3R5cGUuZmVhdHVyZSA9IGZ1bmN0aW9uKGkpIHtcbiAgICBpZiAoaSA8IDAgfHwgaSA+PSB0aGlzLl9mZWF0dXJlcy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcignZmVhdHVyZSBpbmRleCBvdXQgb2YgYm91bmRzJyk7XG5cbiAgICB0aGlzLl9idWZmZXIucG9zID0gdGhpcy5fZmVhdHVyZXNbaV07XG4gICAgdmFyIGVuZCA9IHRoaXMuX2J1ZmZlci5yZWFkVmFyaW50KCkgKyB0aGlzLl9idWZmZXIucG9zO1xuXG4gICAgcmV0dXJuIG5ldyBWZWN0b3JUaWxlRmVhdHVyZSh0aGlzLl9idWZmZXIsIGVuZCwgdGhpcy5leHRlbnQsIHRoaXMuX2tleXMsIHRoaXMuX3ZhbHVlcyk7XG59O1xuIiwiLyoqXG4gKiBDcmVhdGVkIGJ5IFJ5YW4gV2hpdGxleSwgRGFuaWVsIER1YXJ0ZSwgYW5kIE5pY2hvbGFzIEhhbGxhaGFuXG4gKiAgICBvbiA2LzAzLzE0LlxuICovXG52YXIgVXRpbCA9IHJlcXVpcmUoJy4vTVZUVXRpbCcpO1xudmFyIFN0YXRpY0xhYmVsID0gcmVxdWlyZSgnLi9TdGF0aWNMYWJlbC9TdGF0aWNMYWJlbC5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1WVEZlYXR1cmU7XG5cbmZ1bmN0aW9uIE1WVEZlYXR1cmUobXZ0TGF5ZXIsIHZ0ZiwgY3R4LCBpZCwgc3R5bGUpIHtcbiAgaWYgKCF2dGYpIHJldHVybiBudWxsO1xuXG4gIC8vIEFwcGx5IGFsbCBvZiB0aGUgcHJvcGVydGllcyBvZiB2dGYgdG8gdGhpcyBvYmplY3QuXG4gIGZvciAodmFyIGtleSBpbiB2dGYpIHtcbiAgICAvLyBJZ25vcmUgcHJpdmF0ZSBmaWVsZHMuXG4gICAgaWYgKGtleS5jaGFyQXQoMCkgIT09ICdfJykge1xuICAgICAgdGhpc1trZXldID0gdnRmW2tleV07XG4gICAgfVxuICB9XG5cbiAgdGhpcy5tdnRMYXllciA9IG12dExheWVyO1xuICB0aGlzLm12dFNvdXJjZSA9IG12dExheWVyLm12dFNvdXJjZTtcbiAgdGhpcy5tYXAgPSBtdnRMYXllci5tdnRTb3VyY2UubWFwO1xuXG4gIHRoaXMuaWQgPSBpZDtcblxuICB0aGlzLmxheWVyTGluayA9IHRoaXMubXZ0U291cmNlLmxheWVyTGluaztcbiAgdGhpcy50b2dnbGVFbmFibGVkID0gdHJ1ZTtcbiAgdGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xuXG4gIC8vIGhvdyBtdWNoIHdlIGRpdmlkZSB0aGUgY29vcmRpbmF0ZSBmcm9tIHRoZSB2ZWN0b3IgdGlsZVxuICB0aGlzLmRpdmlzb3IgPSB2dGYuZXh0ZW50IC8gY3R4LnRpbGVTaXplO1xuICB0aGlzLmV4dGVudCA9IHZ0Zi5leHRlbnQ7XG4gIHRoaXMudGlsZVNpemUgPSBjdHgudGlsZVNpemU7XG5cbiAgLy9BbiBvYmplY3QgdG8gc3RvcmUgdGhlIHBhdGhzIGFuZCBjb250ZXh0cyBmb3IgdGhpcyBmZWF0dXJlXG4gIHRoaXMudGlsZXMgPSB7fTtcblxuICAvLyBUT0RPOiB0aGluayBhYm91dCB0aGlzIGRlc2lnblxuICB0aGlzLm12dExheWVyLmltZ0NhY2hlID0gdGhpcy5tdnRMYXllci5pbWdDYWNoZSB8fCB7fTtcblxuICB0aGlzLnN0eWxlID0gc3R5bGU7XG5cbiAgLy9BZGQgdG8gdGhlIGNvbGxlY3Rpb25cbiAgdGhpcy5hZGRUaWxlRmVhdHVyZSh2dGYsIGN0eCk7XG5cbiAgdGhpcy5tYXAub24oJ3pvb21lbmQnLCB0aGlzLl96b29tZW5kLCB0aGlzKTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBtdnRMYXllci5vbigncmVtb3ZlJywgZnVuY3Rpb24oKSB7XG4gICAgc2VsZi5tYXAub2ZmKCd6b29tZW5kJywgc2VsZi5fem9vbWVuZCwgc2VsZik7XG4gIH0pO1xuXG4gIGlmIChzdHlsZSAmJiBzdHlsZS5keW5hbWljTGFiZWwgJiYgdHlwZW9mIHN0eWxlLmR5bmFtaWNMYWJlbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMuZHluYW1pY0xhYmVsID0gdGhpcy5tdnRTb3VyY2UuZHluYW1pY0xhYmVsLmNyZWF0ZUZlYXR1cmUodGhpcyk7XG4gIH1cblxuICBhamF4KHRoaXMpO1xufVxuXG5cbmZ1bmN0aW9uIGFqYXgoc2VsZikge1xuICB2YXIgc3R5bGUgPSBzZWxmLnN0eWxlO1xuICBpZiAoc3R5bGUgJiYgc3R5bGUuYWpheFNvdXJjZSAmJiB0eXBlb2Ygc3R5bGUuYWpheFNvdXJjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBhamF4RW5kcG9pbnQgPSBzdHlsZS5hamF4U291cmNlKHNlbGYpO1xuICAgIGlmIChhamF4RW5kcG9pbnQpIHtcbiAgICAgIFV0aWwuZ2V0SlNPTihhamF4RW5kcG9pbnQsIGZ1bmN0aW9uKGVycm9yLCByZXNwb25zZSwgYm9keSkge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBbJ2FqYXhTb3VyY2UgQUpBWCBFcnJvcicsIGVycm9yXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhamF4Q2FsbGJhY2soc2VsZiwgcmVzcG9uc2UpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBhamF4Q2FsbGJhY2soc2VsZiwgcmVzcG9uc2UpIHtcbiAgc2VsZi5hamF4RGF0YSA9IHJlc3BvbnNlO1xuXG4gIC8qKlxuICAgKiBZb3UgY2FuIGF0dGFjaCBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGEgZmVhdHVyZSBpbiB5b3VyIGFwcFxuICAgKiB0aGF0IHdpbGwgZ2V0IGNhbGxlZCB3aGVuZXZlciBuZXcgYWpheERhdGEgY29tZXMgaW4uIFRoaXNcbiAgICogY2FuIGJlIHVzZWQgdG8gdXBkYXRlIFVJIHRoYXQgbG9va3MgYXQgZGF0YSBmcm9tIHdpdGhpbiBhIGZlYXR1cmUuXG4gICAqXG4gICAqIHNldFN0eWxlIG1heSBwb3NzaWJseSBoYXZlIGEgc3R5bGUgd2l0aCBhIGRpZmZlcmVudCBhamF4RGF0YSBzb3VyY2UsXG4gICAqIGFuZCB5b3Ugd291bGQgcG90ZW50aWFsbHkgZ2V0IG5ldyBjb250ZXh0dWFsIGRhdGEgZm9yIHlvdXIgZmVhdHVyZS5cbiAgICpcbiAgICogVE9ETzogVGhpcyBuZWVkcyB0byBiZSBkb2N1bWVudGVkLlxuICAgKi9cbiAgaWYgKHR5cGVvZiBzZWxmLmFqYXhEYXRhUmVjZWl2ZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICBzZWxmLmFqYXhEYXRhUmVjZWl2ZWQoc2VsZiwgcmVzcG9uc2UpO1xuICB9XG5cbiAgc2VsZi5fc2V0U3R5bGUoc2VsZi5tdnRMYXllci5zdHlsZSk7XG4gIHRoaXMucmVkcmF3KCk7XG59XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLl9zZXRTdHlsZSA9IGZ1bmN0aW9uKHN0eWxlRm4pIHtcbiAgdGhpcy5zdHlsZSA9IHN0eWxlRm4odGhpcywgdGhpcy5hamF4RGF0YSk7XG5cbiAgLy8gVGhlIGxhYmVsIGdldHMgcmVtb3ZlZCwgYW5kIHRoZSAocmUpZHJhdyxcbiAgLy8gdGhhdCBpcyBpbml0aWF0ZWQgYnkgdGhlIE1WVExheWVyIGNyZWF0ZXMgYSBuZXcgbGFiZWwuXG4gIHRoaXMucmVtb3ZlTGFiZWwoKTtcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLnNldFN0eWxlID0gZnVuY3Rpb24oc3R5bGVGbikge1xuICB0aGlzLmFqYXhEYXRhID0gbnVsbDtcbiAgdGhpcy5zdHlsZSA9IHN0eWxlRm4odGhpcywgbnVsbCk7XG4gIHZhciBoYXNBamF4U291cmNlID0gYWpheCh0aGlzKTtcbiAgaWYgKCFoYXNBamF4U291cmNlKSB7XG4gICAgLy8gVGhlIGxhYmVsIGdldHMgcmVtb3ZlZCwgYW5kIHRoZSAocmUpZHJhdyxcbiAgICAvLyB0aGF0IGlzIGluaXRpYXRlZCBieSB0aGUgTVZUTGF5ZXIgY3JlYXRlcyBhIG5ldyBsYWJlbC5cbiAgICB0aGlzLnJlbW92ZUxhYmVsKCk7XG4gIH1cbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbihjYW52YXNJRCkge1xuICAvL0dldCB0aGUgaW5mbyBmcm9tIHRoZSB0aWxlcyBsaXN0XG4gIHZhciB0aWxlSW5mbyA9ICB0aGlzLnRpbGVzW2NhbnZhc0lEXTtcblxuICB2YXIgdnRmID0gdGlsZUluZm8udnRmO1xuICB2YXIgY3R4ID0gdGlsZUluZm8uY3R4O1xuXG4gIC8vR2V0IHRoZSBhY3R1YWwgY2FudmFzIGZyb20gdGhlIHBhcmVudCBsYXllcidzIF90aWxlcyBvYmplY3QuXG4gIHZhciB4eSA9IGNhbnZhc0lELnNwbGl0KFwiOlwiKS5zbGljZSgxLCAzKS5qb2luKFwiOlwiKTtcbiAgY3R4LmNhbnZhcyA9IHRoaXMubXZ0TGF5ZXIuX3RpbGVzW3h5XTtcblxuLy8gIFRoaXMgY291bGQgYmUgdXNlZCB0byBkaXJlY3RseSBjb21wdXRlIHRoZSBzdHlsZSBmdW5jdGlvbiBmcm9tIHRoZSBsYXllciBvbiBldmVyeSBkcmF3LlxuLy8gIFRoaXMgaXMgbXVjaCBsZXNzIGVmZmljaWVudC4uLlxuLy8gIHRoaXMuc3R5bGUgPSB0aGlzLm12dExheWVyLnN0eWxlKHRoaXMpO1xuXG4gIGlmICh0aGlzLnNlbGVjdGVkKSB7XG4gICAgdmFyIHN0eWxlID0gdGhpcy5zdHlsZS5zZWxlY3RlZCB8fCB0aGlzLnN0eWxlO1xuICB9IGVsc2Uge1xuICAgIHZhciBzdHlsZSA9IHRoaXMuc3R5bGU7XG4gIH1cblxuICBzd2l0Y2ggKHZ0Zi50eXBlKSB7XG4gICAgY2FzZSAxOiAvL1BvaW50XG4gICAgICB0aGlzLl9kcmF3UG9pbnQoY3R4LCB2dGYuY29vcmRpbmF0ZXMsIHN0eWxlKTtcbiAgICAgIGlmICghdGhpcy5zdGF0aWNMYWJlbCAmJiB0eXBlb2YgdGhpcy5zdHlsZS5zdGF0aWNMYWJlbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBpZiAodGhpcy5zdHlsZS5hamF4U291cmNlICYmICF0aGlzLmFqYXhEYXRhKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZHJhd1N0YXRpY0xhYmVsKGN0eCwgdnRmLmNvb3JkaW5hdGVzLCBzdHlsZSk7XG4gICAgICB9XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgMjogLy9MaW5lU3RyaW5nXG4gICAgICB0aGlzLl9kcmF3TGluZVN0cmluZyhjdHgsIHZ0Zi5jb29yZGluYXRlcywgc3R5bGUpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlIDM6IC8vUG9seWdvblxuICAgICAgdGhpcy5fZHJhd1BvbHlnb24oY3R4LCB2dGYuY29vcmRpbmF0ZXMsIHN0eWxlKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5tYW5hZ2VkIHR5cGU6ICcgKyB2dGYudHlwZSk7XG4gIH1cblxufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuZ2V0UGF0aHNGb3JUaWxlID0gZnVuY3Rpb24oY2FudmFzSUQpIHtcbiAgdmFyIHRpbGUgPSB0aGlzLnRpbGVzW2NhbnZhc0lEXTtcbiAgaWYgKHRpbGUpIHtcbiAgICByZXR1cm4gdGlsZS5wYXRocztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLmFkZFRpbGVGZWF0dXJlID0gZnVuY3Rpb24odnRmLCBjdHgpIHtcbiAgLy9TdG9yZSB0aGUgaW1wb3J0YW50IGl0ZW1zIGluIHRoZSB0aWxlcyBsaXN0XG5cbiAgLy9XZSBvbmx5IHdhbnQgdG8gc3RvcmUgaW5mbyBmb3IgdGlsZXMgZm9yIHRoZSBjdXJyZW50IG1hcCB6b29tLiAgSWYgaXQgaXMgdGlsZSBpbmZvIGZvciBhbm90aGVyIHpvb20gbGV2ZWwsIGlnbm9yZSBpdFxuICAvL0Fsc28sIGlmIHRoZXJlIGFyZSBleGlzdGluZyB0aWxlcyBpbiB0aGUgbGlzdCBmb3Igb3RoZXIgem9vbSBsZXZlbHMsIGV4cHVuZ2UgdGhlbS5cbiAgdmFyIHpvb20gPSB0aGlzLm1hcC5nZXRab29tKCk7XG5cbiAgaWYoY3R4Lnpvb20gIT0gem9vbSkgcmV0dXJuO1xuXG4gIHRoaXMudGlsZXNbY3R4LmlkXSA9IHtcbiAgICBjdHg6IGN0eCxcbiAgICB2dGY6IHZ0ZixcbiAgICBwYXRoczogW11cbiAgfTtcblxufTtcblxuXG4vKipcbiAqIENsZWFyIHRoZSBpbm5lciBsaXN0IG9mIHRpbGUgZmVhdHVyZXMgaWYgdGhleSBkb24ndCBtYXRjaCB0aGUgZ2l2ZW4gem9vbS5cbiAqXG4gKiBAcGFyYW0gem9vbVxuICovXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5jbGVhclRpbGVGZWF0dXJlcyA9IGZ1bmN0aW9uKHpvb20pIHtcbiAgLy9JZiBzdG9yZWQgdGlsZXMgZXhpc3QgZm9yIG90aGVyIHpvb20gbGV2ZWxzLCBleHB1bmdlIHRoZW0gZnJvbSB0aGUgbGlzdC5cbiAgZm9yICh2YXIga2V5IGluIHRoaXMudGlsZXMpIHtcbiAgICAgaWYoa2V5LnNwbGl0KFwiOlwiKVswXSAhPSB6b29tKSBkZWxldGUgdGhpcy50aWxlc1trZXldO1xuICB9XG59O1xuXG4vKipcbiAqIFJlZHJhd3MgYWxsIG9mIHRoZSB0aWxlcyBhc3NvY2lhdGVkIHdpdGggYSBmZWF0dXJlLiBVc2VmdWwgZm9yXG4gKiBzdHlsZSBjaGFuZ2UgYW5kIHRvZ2dsaW5nLlxuICovXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5yZWRyYXcgPSBmdW5jdGlvbigpIHtcbiAgLy9SZWRyYXcgdGhlIHdob2xlIHRpbGUsIG5vdCBqdXN0IHRoaXMgdnRmXG4gIGZvciAodmFyIGlkIGluIHRoaXMudGlsZXMpIHtcbiAgICB2YXIgdGlsZVpvb20gPSBwYXJzZUludChpZC5zcGxpdCgnOicpWzBdKTtcbiAgICB2YXIgbWFwWm9vbSA9IHRoaXMubWFwLmdldFpvb20oKTtcbiAgICBpZiAodGlsZVpvb20gPT09IG1hcFpvb20pIHtcbiAgICAgIC8vUmVkcmF3IHRoZSB0aWxlXG4gICAgICB0aGlzLm12dExheWVyLnJlZHJhd1RpbGUoaWQpO1xuICAgIH1cbiAgfVxufVxuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuc2VsZWN0ZWQpIHtcbiAgICB0aGlzLmRlc2VsZWN0KCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5zZWxlY3QoKTtcbiAgfVxufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuc2VsZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2VsZWN0ZWQgPSB0cnVlO1xuICB0aGlzLm12dFNvdXJjZS5mZWF0dXJlU2VsZWN0ZWQodGhpcyk7XG4gIHRoaXMucmVkcmF3KCk7XG4gIHZhciBsaW5rZWRGZWF0dXJlID0gdGhpcy5saW5rZWRGZWF0dXJlKCk7XG4gIGlmIChsaW5rZWRGZWF0dXJlICYmIGxpbmtlZEZlYXR1cmUuc3RhdGljTGFiZWwgJiYgIWxpbmtlZEZlYXR1cmUuc3RhdGljTGFiZWwuc2VsZWN0ZWQpIHtcbiAgICBsaW5rZWRGZWF0dXJlLnN0YXRpY0xhYmVsLnNlbGVjdCgpO1xuICB9XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5kZXNlbGVjdCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnNlbGVjdGVkID0gZmFsc2U7XG4gIHRoaXMubXZ0U291cmNlLmZlYXR1cmVEZXNlbGVjdGVkKHRoaXMpO1xuICB0aGlzLnJlZHJhdygpO1xuICB2YXIgbGlua2VkRmVhdHVyZSA9IHRoaXMubGlua2VkRmVhdHVyZSgpO1xuICBpZiAobGlua2VkRmVhdHVyZSAmJiBsaW5rZWRGZWF0dXJlLnN0YXRpY0xhYmVsICYmIGxpbmtlZEZlYXR1cmUuc3RhdGljTGFiZWwuc2VsZWN0ZWQpIHtcbiAgICBsaW5rZWRGZWF0dXJlLnN0YXRpY0xhYmVsLmRlc2VsZWN0KCk7XG4gIH1cbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXZlbnRUeXBlLCBjYWxsYmFjaykge1xuICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50VHlwZV0gPSBjYWxsYmFjaztcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLl9kcmF3UG9pbnQgPSBmdW5jdGlvbihjdHgsIGNvb3Jkc0FycmF5LCBzdHlsZSkge1xuICBpZiAoIXN0eWxlKSByZXR1cm47XG4gIGlmICghY3R4IHx8ICFjdHguY2FudmFzKSByZXR1cm47XG5cbiAgdmFyIHRpbGUgPSB0aGlzLnRpbGVzW2N0eC5pZF07XG5cbiAgdmFyIHAgPSB0aGlzLl90aWxlUG9pbnQoY29vcmRzQXJyYXlbMF1bMF0pO1xuICB2YXIgYyA9IGN0eC5jYW52YXM7XG4gIHZhciBjdHgyZDtcblxuICB0cnkge1xuICAgIGN0eDJkID0gYy5nZXRDb250ZXh0KCcyZCcpO1xuICB9XG4gIGNhdGNoKGUpIHtcbiAgICBjb25zb2xlLmxvZyhcIl9kcmF3UG9pbnQgZXJyb3I6IFwiICsgZSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCdpY29uVXJsJyBpbiBzdHlsZSl7XG4gICAgdGhpcy5fZHJhd1BvaW50SWNvbihjdHgsIGN0eDJkLCBwLCBzdHlsZSk7IFxuICB9IGVsc2Uge1xuICAgIHRoaXMuX2RyYXdQb2ludENpcmNsZShjdHgsIGN0eDJkLCBwLCBzdHlsZSk7XG4gIH1cblxuICB0aWxlLnBhdGhzLnB1c2goW3BdKTtcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLl9kcmF3UG9pbnRDaXJjbGUgPSBmdW5jdGlvbihjdHgsIGN0eDJkLCBwLCBzdHlsZSkge1xuXG4gIC8vR2V0IHJhZGl1c1xuICB2YXIgcmFkaXVzID0gMTtcbiAgaWYgKHR5cGVvZiBzdHlsZS5yYWRpdXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICByYWRpdXMgPSBzdHlsZS5yYWRpdXMoY3R4Lnpvb20pOyAvL0FsbG93cyBmb3Igc2NhbGUgZGVwZW5kZW50IHJlZG5lcmluZ1xuICB9XG4gIGVsc2V7XG4gICAgcmFkaXVzID0gc3R5bGUucmFkaXVzO1xuICB9XG5cbiAgY3R4MmQuYmVnaW5QYXRoKCk7XG4gIGN0eDJkLmZpbGxTdHlsZSA9IHN0eWxlLmNvbG9yO1xuICBjdHgyZC5hcmMocC54LCBwLnksIHJhZGl1cywgMCwgTWF0aC5QSSAqIDIpO1xuICBjdHgyZC5jbG9zZVBhdGgoKTtcbiAgY3R4MmQuZmlsbCgpO1xuXG4gIGlmKHN0eWxlLmxpbmVXaWR0aCAmJiBzdHlsZS5zdHJva2VTdHlsZSl7XG4gICAgY3R4MmQubGluZVdpZHRoID0gc3R5bGUubGluZVdpZHRoO1xuICAgIGN0eDJkLnN0cm9rZVN0eWxlID0gc3R5bGUuc3Ryb2tlU3R5bGU7XG4gICAgY3R4MmQuc3Ryb2tlKCk7XG4gIH1cblxuICBjdHgyZC5yZXN0b3JlKCk7XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5fZHJhd1BvaW50SWNvbiA9IGZ1bmN0aW9uKGN0eCwgY3R4MmQsIHAsIHN0eWxlKXtcblxuICAgIHZhciB1cmwgPSBzdHlsZS5pY29uVXJsO1xuICAgIHZhciBpbWc7XG4gICAgaWYgKCEodXJsIGluIHRoaXMubXZ0TGF5ZXIuaW1nQ2FjaGUpKXtcbiAgICAgICAgaW1nID0gbmV3IEltYWdlKCk7XG4gICAgICAgIGltZy5zcmMgPSB1cmw7XG4gICAgICAgIHRoaXMubXZ0TGF5ZXIuaW1nQ2FjaGVbdXJsXSA9IGltZztcbiAgICB9IGVsc2Uge1xuICAgICAgICBpbWcgPSB0aGlzLm12dExheWVyLmltZ0NhY2hlW3VybF07XG4gICAgfVxuXG4gICAgLy9HZXQgcmFkaXVzXG4gICAgdmFyIHJhZGl1cyA9IDE7XG4gICAgaWYgKHR5cGVvZiBzdHlsZS5yYWRpdXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJhZGl1cyA9IHN0eWxlLnJhZGl1cyhjdHguem9vbSk7IC8vQWxsb3dzIGZvciBzY2FsZSBkZXBlbmRlbnQgcmVkbmVyaW5nXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmFkaXVzID0gc3R5bGUucmFkaXVzO1xuICAgIH1cblxuICAgIGlmIChpbWcuY29tcGxldGUpe1xuICAgICAgICBjdHgyZC5kcmF3SW1hZ2UoaW1nLCBwLnggLSByYWRpdXMsIHAueSAtIHJhZGl1cywgcmFkaXVzKjIsIHJhZGl1cyoyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAoZnVuY3Rpb24oeCx5KXtcbiAgICAgICAgICAgICQoaW1nKS5sb2FkKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgY3R4MmQuZHJhd0ltYWdlKHRoaXMsIHggLSByYWRpdXMsIHkgLSByYWRpdXMsIHJhZGl1cyoyLCByYWRpdXMqMik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSkocC54LCBwLnkpO1xuICAgIH1cbn1cblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX2RyYXdMaW5lU3RyaW5nID0gZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuICBpZiAoIWN0eCB8fCAhY3R4LmNhbnZhcykgcmV0dXJuO1xuXG4gIHZhciBjdHgyZCA9IGN0eC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgY3R4MmQuc3Ryb2tlU3R5bGUgPSBzdHlsZS5jb2xvcjtcbiAgY3R4MmQubGluZVdpZHRoID0gc3R5bGUuc2l6ZTtcbiAgY3R4MmQuYmVnaW5QYXRoKCk7XG5cbiAgdmFyIHByb2pDb29yZHMgPSBbXTtcbiAgdmFyIHRpbGUgPSB0aGlzLnRpbGVzW2N0eC5pZF07XG5cbiAgZm9yICh2YXIgZ2lkeCBpbiBjb29yZHNBcnJheSkge1xuICAgIHZhciBjb29yZHMgPSBjb29yZHNBcnJheVtnaWR4XTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBtZXRob2QgPSAoaSA9PT0gMCA/ICdtb3ZlJyA6ICdsaW5lJykgKyAnVG8nO1xuICAgICAgdmFyIHByb2ogPSB0aGlzLl90aWxlUG9pbnQoY29vcmRzW2ldKTtcbiAgICAgIHByb2pDb29yZHMucHVzaChwcm9qKTtcbiAgICAgIGN0eDJkW21ldGhvZF0ocHJvai54LCBwcm9qLnkpO1xuICAgIH1cbiAgfVxuXG4gIGN0eDJkLnN0cm9rZSgpO1xuICBjdHgyZC5yZXN0b3JlKCk7XG5cbiAgdGlsZS5wYXRocy5wdXNoKHByb2pDb29yZHMpO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUuX2RyYXdQb2x5Z29uID0gZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuICBpZiAoIWN0eCB8fCAhY3R4LmNhbnZhcykgcmV0dXJuO1xuICBjb25zb2xlLmxvZyhcIk1WVEZlYXR1cmU6IHN0eWxlIGlzIFwiICsgSlNPTi5zdHJpbmdpZnkoc3R5bGUpKTtcblxuICB2YXIgY3R4MmQgPSBjdHguY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cbiAgLy8gU2F2ZSBhbmQgcmVuZGVyIGZlYXR1cmUgdy8gc3BlY2lmaWVkIGFscGhhXG4gIHZhciBwcmVBbHBoYSA9IGN0eDJkLmdsb2JhbEFscGhhO1xuICBjdHgyZC5nbG9iYWxBbHBoYSA9IHN0eWxlLm9wYWNpdHkgfHwgcHJlQWxwaGE7XG5cbiAgdmFyIG91dGxpbmUgPSBzdHlsZS5vdXRsaW5lO1xuXG4gIC8vIGNvbG9yIG1heSBiZSBkZWZpbmVkIHZpYSBmdW5jdGlvbiB0byBtYWtlIGNob3JvcGxldGggd29yayByaWdodFxuICBpZiAodHlwZW9mIHN0eWxlLmNvbG9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY3R4MmQuZmlsbFN0eWxlID0gc3R5bGUuY29sb3IoY3R4MmQpO1xuICB9IGVsc2Uge1xuICAgIGN0eDJkLmZpbGxTdHlsZSA9IHN0eWxlLmNvbG9yO1xuICB9XG5cbiAgaWYgKG91dGxpbmUpIHtcbiAgICBjdHgyZC5zdHJva2VTdHlsZSA9IG91dGxpbmUuY29sb3I7XG4gICAgY3R4MmQubGluZVdpZHRoID0gb3V0bGluZS5zaXplO1xuICB9XG4gIGN0eDJkLmJlZ2luUGF0aCgpO1xuXG4gIHZhciBwcm9qQ29vcmRzID0gW107XG4gIHZhciB0aWxlID0gdGhpcy50aWxlc1tjdHguaWRdO1xuXG4gIHZhciBmZWF0dXJlTGFiZWwgPSB0aGlzLmR5bmFtaWNMYWJlbDtcbiAgaWYgKGZlYXR1cmVMYWJlbCkge1xuICAgIGZlYXR1cmVMYWJlbC5hZGRUaWxlUG9seXMoY3R4LCBjb29yZHNBcnJheSk7XG4gIH1cblxuICBmb3IgKHZhciBnaWR4ID0gMCwgbGVuID0gY29vcmRzQXJyYXkubGVuZ3RoOyBnaWR4IDwgbGVuOyBnaWR4KyspIHtcbiAgICB2YXIgY29vcmRzID0gY29vcmRzQXJyYXlbZ2lkeF07XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNvb3JkID0gY29vcmRzW2ldO1xuICAgICAgdmFyIG1ldGhvZCA9IChpID09PSAwID8gJ21vdmUnIDogJ2xpbmUnKSArICdUbyc7XG4gICAgICB2YXIgcHJvaiA9IHRoaXMuX3RpbGVQb2ludChjb29yZHNbaV0pO1xuICAgICAgcHJvakNvb3Jkcy5wdXNoKHByb2opO1xuICAgICAgY3R4MmRbbWV0aG9kXShwcm9qLngsIHByb2oueSk7XG4gICAgfVxuICB9XG5cbiAgY3R4MmQuY2xvc2VQYXRoKCk7XG4gIGN0eDJkLmZpbGwoKTtcbiAgaWYgKG91dGxpbmUpIHtcbiAgICBjdHgyZC5zdHJva2UoKTtcbiAgfVxuXG4gIHRpbGUucGF0aHMucHVzaChwcm9qQ29vcmRzKTtcblxuICAvLyBSZXN0b3JlIGFscGhhXG4gIGN0eDJkLmdsb2JhbEFscGhhID0gcHJlQWxwaGE7XG59O1xuXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5fZHJhd1N0YXRpY0xhYmVsID0gZnVuY3Rpb24oY3R4LCBjb29yZHNBcnJheSwgc3R5bGUpIHtcbiAgaWYgKCFzdHlsZSkgcmV0dXJuO1xuICBpZiAoIWN0eCkgcmV0dXJuO1xuXG4gIC8vIElmIHRoZSBjb3JyZXNwb25kaW5nIGxheWVyIGlzIG5vdCBvbiB0aGUgbWFwLCBcbiAgLy8gd2UgZG9udCB3YW50IHRvIHB1dCBvbiBhIGxhYmVsLlxuICBpZiAoIXRoaXMubXZ0TGF5ZXIuX21hcCkgcmV0dXJuO1xuXG4gIHZhciB2ZWNQdCA9IHRoaXMuX3RpbGVQb2ludChjb29yZHNBcnJheVswXVswXSk7XG5cbiAgLy8gV2UncmUgbWFraW5nIGEgc3RhbmRhcmQgTGVhZmxldCBNYXJrZXIgZm9yIHRoaXMgbGFiZWwuXG4gIHZhciBwID0gdGhpcy5fcHJvamVjdCh2ZWNQdCwgY3R4LnRpbGUueCwgY3R4LnRpbGUueSwgdGhpcy5leHRlbnQsIHRoaXMudGlsZVNpemUpOyAvL3ZlY3RpbGUgcHQgdG8gbWVyYyBwdFxuICB2YXIgbWVyY1B0ID0gTC5wb2ludChwLngsIHAueSk7IC8vIG1ha2UgaW50byBsZWFmbGV0IG9ialxuICB2YXIgbGF0TG5nID0gdGhpcy5tYXAudW5wcm9qZWN0KG1lcmNQdCk7IC8vIG1lcmMgcHQgdG8gbGF0bG5nXG5cbiAgdGhpcy5zdGF0aWNMYWJlbCA9IG5ldyBTdGF0aWNMYWJlbCh0aGlzLCBjdHgsIGxhdExuZywgc3R5bGUpO1xuICB0aGlzLm12dExheWVyLmZlYXR1cmVXaXRoTGFiZWxBZGRlZCh0aGlzKTtcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLnJlbW92ZUxhYmVsID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5zdGF0aWNMYWJlbCkgcmV0dXJuO1xuICB0aGlzLnN0YXRpY0xhYmVsLnJlbW92ZSgpO1xuICB0aGlzLnN0YXRpY0xhYmVsID0gbnVsbDtcbn07XG5cbk1WVEZlYXR1cmUucHJvdG90eXBlLl96b29tZW5kID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMucmVtb3ZlTGFiZWwoKTtcbiAgdGhpcy5jbGVhclRpbGVGZWF0dXJlcyh0aGlzLm1hcC5nZXRab29tKCkpO1xufTtcblxuLyoqXG4gKiBQcm9qZWN0cyBhIHZlY3RvciB0aWxlIHBvaW50IHRvIHRoZSBTcGhlcmljYWwgTWVyY2F0b3IgcGl4ZWwgc3BhY2UgZm9yIGEgZ2l2ZW4gem9vbSBsZXZlbC5cbiAqXG4gKiBAcGFyYW0gdmVjUHRcbiAqIEBwYXJhbSB0aWxlWFxuICogQHBhcmFtIHRpbGVZXG4gKiBAcGFyYW0gZXh0ZW50XG4gKiBAcGFyYW0gdGlsZVNpemVcbiAqL1xuTVZURmVhdHVyZS5wcm90b3R5cGUuX3Byb2plY3QgPSBmdW5jdGlvbih2ZWNQdCwgdGlsZVgsIHRpbGVZLCBleHRlbnQsIHRpbGVTaXplKSB7XG4gIHZhciB4T2Zmc2V0ID0gdGlsZVggKiB0aWxlU2l6ZTtcbiAgdmFyIHlPZmZzZXQgPSB0aWxlWSAqIHRpbGVTaXplO1xuICByZXR1cm4ge1xuICAgIHg6IE1hdGguZmxvb3IodmVjUHQueCArIHhPZmZzZXQpLFxuICAgIHk6IE1hdGguZmxvb3IodmVjUHQueSArIHlPZmZzZXQpXG4gIH07XG59O1xuXG4vKipcbiAqIFRha2VzIGEgY29vcmRpbmF0ZSBmcm9tIGEgdmVjdG9yIHRpbGUgYW5kIHR1cm5zIGl0IGludG8gYSBMZWFmbGV0IFBvaW50LlxuICpcbiAqIEBwYXJhbSBjdHhcbiAqIEBwYXJhbSBjb29yZHNcbiAqIEByZXR1cm5zIHtlR2VvbVR5cGUuUG9pbnR9XG4gKiBAcHJpdmF0ZVxuICovXG5NVlRGZWF0dXJlLnByb3RvdHlwZS5fdGlsZVBvaW50ID0gZnVuY3Rpb24oY29vcmRzKSB7XG4gIHJldHVybiBuZXcgTC5Qb2ludChjb29yZHMueCAvIHRoaXMuZGl2aXNvciwgY29vcmRzLnkgLyB0aGlzLmRpdmlzb3IpO1xufTtcblxuTVZURmVhdHVyZS5wcm90b3R5cGUubGlua2VkRmVhdHVyZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbGlua2VkTGF5ZXIgPSB0aGlzLm12dExheWVyLmxpbmtlZExheWVyKCk7XG4gIGlmKGxpbmtlZExheWVyKXtcbiAgICB2YXIgbGlua2VkRmVhdHVyZSA9IGxpbmtlZExheWVyLmZlYXR1cmVzW3RoaXMuaWRdO1xuICAgIHJldHVybiBsaW5rZWRGZWF0dXJlO1xuICB9ZWxzZXtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuIiwiLyoqXG4gKiBDcmVhdGVkIGJ5IFJ5YW4gV2hpdGxleSBvbiA1LzE3LzE0LlxuICovXG4vKiogRm9ya2VkIGZyb20gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vREd1aWRpLzE3MTYwMTAgKiovXG5cbnZhciBNVlRGZWF0dXJlID0gcmVxdWlyZSgnLi9NVlRGZWF0dXJlJyk7XG5cbnZhciBVdGlsID0gcmVxdWlyZSgnLi9NVlRVdGlsJyk7XG52YXIgcmJ1c2ggPSByZXF1aXJlKCdyYnVzaCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuVGlsZUxheWVyLkNhbnZhcy5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBkZWJ1ZzogZmFsc2UsXG4gICAgaXNIaWRkZW5MYXllcjogZmFsc2UsXG4gICAgZ2V0SURGb3JMYXllckZlYXR1cmU6IGZ1bmN0aW9uKCkge30sXG4gICAgdGlsZVNpemU6IDI1NixcbiAgICBsaW5lQ2xpY2tUb2xlcmFuY2U6IDIsXG4gICAgYnVmZmVyOiA1LFxuICB9LFxuXG4gIF9mZWF0dXJlSXNDbGlja2VkOiB7fSxcblxuICBfaXNQb2ludEluUG9seTogZnVuY3Rpb24ocHQsIHBvbHkpIHtcbiAgICBpZihwb2x5ICYmIHBvbHkubGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBjID0gZmFsc2UsIGkgPSAtMSwgbCA9IHBvbHkubGVuZ3RoLCBqID0gbCAtIDE7ICsraSA8IGw7IGogPSBpKVxuICAgICAgICAoKHBvbHlbaV0ueSA8PSBwdC55ICYmIHB0LnkgPCBwb2x5W2pdLnkpIHx8IChwb2x5W2pdLnkgPD0gcHQueSAmJiBwdC55IDwgcG9seVtpXS55KSlcbiAgICAgICAgJiYgKHB0LnggPCAocG9seVtqXS54IC0gcG9seVtpXS54KSAqIChwdC55IC0gcG9seVtpXS55KSAvIChwb2x5W2pdLnkgLSBwb2x5W2ldLnkpICsgcG9seVtpXS54KVxuICAgICAgICAmJiAoYyA9ICFjKTtcbiAgICAgIHJldHVybiBjO1xuICAgIH1cbiAgfSxcblxuICBfZ2V0RGlzdGFuY2VGcm9tTGluZTogZnVuY3Rpb24ocHQsIHB0cykge1xuICAgIHZhciBtaW4gPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgaWYgKHB0cyAmJiBwdHMubGVuZ3RoID4gMSkge1xuICAgICAgcHQgPSBMLnBvaW50KHB0LngsIHB0LnkpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBwdHMubGVuZ3RoIC0gMTsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIgdGVzdCA9IHRoaXMuX3Byb2plY3RQb2ludE9uTGluZVNlZ21lbnQocHQsIHB0c1tpXSwgcHRzW2kgKyAxXSk7XG4gICAgICAgIGlmICh0ZXN0LmRpc3RhbmNlIDw9IG1pbikge1xuICAgICAgICAgIG1pbiA9IHRlc3QuZGlzdGFuY2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1pbjtcbiAgfSxcblxuICBfcHJvamVjdFBvaW50T25MaW5lU2VnbWVudDogZnVuY3Rpb24ocCwgcjAsIHIxKSB7XG4gICAgdmFyIGxpbmVMZW5ndGggPSByMC5kaXN0YW5jZVRvKHIxKTtcbiAgICBpZiAobGluZUxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIHtkaXN0YW5jZTogcC5kaXN0YW5jZVRvKHIwKSwgY29vcmRpbmF0ZTogcjB9O1xuICAgIH1cbiAgICB2YXIgdSA9ICgocC54IC0gcjAueCkgKiAocjEueCAtIHIwLngpICsgKHAueSAtIHIwLnkpICogKHIxLnkgLSByMC55KSkgLyBNYXRoLnBvdyhsaW5lTGVuZ3RoLCAyKTtcbiAgICBpZiAodSA8IDAuMDAwMDAwMSkge1xuICAgICAgICByZXR1cm4ge2Rpc3RhbmNlOiBwLmRpc3RhbmNlVG8ocjApLCBjb29yZGluYXRlOiByMH07XG4gICAgfVxuICAgIGlmICh1ID4gMC45OTk5OTk5KSB7XG4gICAgICAgIHJldHVybiB7ZGlzdGFuY2U6IHAuZGlzdGFuY2VUbyhyMSksIGNvb3JkaW5hdGU6IHIxfTtcbiAgICB9XG4gICAgdmFyIGEgPSBMLnBvaW50KHIwLnggKyB1ICogKHIxLnggLSByMC54KSwgcjAueSArIHUgKiAocjEueSAtIHIwLnkpKTtcbiAgICByZXR1cm4ge2Rpc3RhbmNlOiBwLmRpc3RhbmNlVG8oYSksIHBvaW50OiBhfTtcbiAgfSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbihtdnRTb3VyY2UsIG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5tdnRTb3VyY2UgPSBtdnRTb3VyY2U7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG5cbiAgICB0aGlzLnN0eWxlID0gb3B0aW9ucy5zdHlsZTtcbiAgICB0aGlzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzID0ge307XG4gICAgdGhpcy5mZWF0dXJlcyA9IHt9O1xuICAgIHRoaXMuZmVhdHVyZXNXaXRoTGFiZWxzID0gW107XG4gICAgdGhpcy5faGlnaGVzdENvdW50ID0gMDtcbiAgfSxcblxuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgTC5UaWxlTGF5ZXIuQ2FudmFzLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG4gIH0sXG5cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgcmVtb3ZlTGFiZWxzKHRoaXMpO1xuICAgIEwuVGlsZUxheWVyLkNhbnZhcy5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xuICB9LFxuXG4gIGRyYXdUaWxlOiBmdW5jdGlvbihjYW52YXMsIHRpbGVQb2ludCwgem9vbSkge1xuXG4gICAgdmFyIGN0eCA9IHtcbiAgICAgIGNhbnZhczogY2FudmFzLFxuICAgICAgdGlsZTogdGlsZVBvaW50LFxuICAgICAgem9vbTogem9vbSxcbiAgICAgIHRpbGVTaXplOiB0aGlzLm9wdGlvbnMudGlsZVNpemVcbiAgICB9O1xuXG4gICAgY3R4LmlkID0gVXRpbC5nZXRDb250ZXh0SUQoY3R4KTtcblxuICAgIGlmICghdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW2N0eC5pZF0pIHtcbiAgICAgIHRoaXMuX2luaXRpYWxpemVGZWF0dXJlc0hhc2goY3R4KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmZlYXR1cmVzKSB7XG4gICAgICB0aGlzLmZlYXR1cmVzID0ge307XG4gICAgfVxuXG4gIH0sXG5cbiAgX2luaXRpYWxpemVGZWF0dXJlc0hhc2g6IGZ1bmN0aW9uKGN0eCl7XG4gICAgdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW2N0eC5pZF0gPSB7XG4gICAgICBmZWF0dXJlczogW10sXG4gICAgICBjYW52YXM6IGN0eC5jYW52YXMsXG4gICAgICBpbmRleDogcmJ1c2goOSlcbiAgICB9O1xuICB9LFxuXG4gIF9kcmF3OiBmdW5jdGlvbihjdHgpIHtcbiAgICAvL0RyYXcgaXMgaGFuZGxlZCBieSB0aGUgcGFyZW50IE1WVFNvdXJjZSBvYmplY3RcbiAgfSxcbiAgZ2V0Q2FudmFzOiBmdW5jdGlvbihwYXJlbnRDdHgpe1xuICAgIC8vVGhpcyBnZXRzIGNhbGxlZCBpZiBhIHZlY3RvciB0aWxlIGZlYXR1cmUgaGFzIGFscmVhZHkgYmVlbiBwYXJzZWQuXG4gICAgLy9XZSd2ZSBhbHJlYWR5IGdvdCB0aGUgZ2VvbSwganVzdCBnZXQgb24gd2l0aCB0aGUgZHJhd2luZy5cbiAgICAvL05lZWQgYSB3YXkgdG8gcGx1Y2sgYSBjYW52YXMgZWxlbWVudCBmcm9tIHRoaXMgbGF5ZXIgZ2l2ZW4gdGhlIHBhcmVudCBsYXllcidzIGlkLlxuICAgIC8vV2FpdCBmb3IgaXQgdG8gZ2V0IGxvYWRlZCBiZWZvcmUgcHJvY2VlZGluZy5cbiAgICB2YXIgdGlsZVBvaW50ID0gcGFyZW50Q3R4LnRpbGU7XG4gICAgdmFyIGN0eCA9IHRoaXMuX3RpbGVzW3RpbGVQb2ludC54ICsgXCI6XCIgKyB0aWxlUG9pbnQueV07XG5cbiAgICBpZihjdHgpe1xuICAgICAgcGFyZW50Q3R4LmNhbnZhcyA9IGN0eDtcbiAgICAgIHRoaXMucmVkcmF3VGlsZShwYXJlbnRDdHguaWQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vVGhpcyBpcyBhIHRpbWVyIHRoYXQgd2lsbCB3YWl0IGZvciBhIGNyaXRlcmlvbiB0byByZXR1cm4gdHJ1ZS5cbiAgICAvL0lmIG5vdCB0cnVlIHdpdGhpbiB0aGUgdGltZW91dCBkdXJhdGlvbiwgaXQgd2lsbCBtb3ZlIG9uLlxuICAgIHdhaXRGb3IoZnVuY3Rpb24gKCkge1xuICAgICAgICBjdHggPSBzZWxmLl90aWxlc1t0aWxlUG9pbnQueCArIFwiOlwiICsgdGlsZVBvaW50LnldO1xuICAgICAgICBpZihjdHgpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uKCl7XG4gICAgICAgIC8vV2hlbiBpdCBmaW5pc2hlcywgZG8gdGhpcy5cbiAgICAgICAgY3R4ID0gc2VsZi5fdGlsZXNbdGlsZVBvaW50LnggKyBcIjpcIiArIHRpbGVQb2ludC55XTtcbiAgICAgICAgcGFyZW50Q3R4LmNhbnZhcyA9IGN0eDtcbiAgICAgICAgc2VsZi5yZWRyYXdUaWxlKHBhcmVudEN0eC5pZCk7XG5cbiAgICAgIH0sIC8vd2hlbiBkb25lLCBnbyB0byBuZXh0IGZsb3dcbiAgICAgIDIwMDApOyAvL1RoZSBUaW1lb3V0IG1pbGxpc2Vjb25kcy4gIEFmdGVyIHRoaXMsIGdpdmUgdXAgYW5kIG1vdmUgb25cblxuICB9LFxuXG4gIHBhcnNlVmVjdG9yVGlsZUxheWVyOiBmdW5jdGlvbih2dGwsIGN0eCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgdGlsZVBvaW50ID0gY3R4LnRpbGU7XG4gICAgdmFyIGxheWVyQ3R4ICA9IHsgY2FudmFzOiBudWxsLCBpZDogY3R4LmlkLCB0aWxlOiBjdHgudGlsZSwgem9vbTogY3R4Lnpvb20sIHRpbGVTaXplOiBjdHgudGlsZVNpemV9O1xuXG4gICAgLy9TZWUgaWYgd2UgY2FuIHBsdWNrIHRoZSBjaGlsZCB0aWxlIGZyb20gdGhpcyBQQkYgdGlsZSBsYXllciBiYXNlZCBvbiB0aGUgbWFzdGVyIGxheWVyJ3MgdGlsZSBpZC5cbiAgICBsYXllckN0eC5jYW52YXMgPSBzZWxmLl90aWxlc1t0aWxlUG9pbnQueCArIFwiOlwiICsgdGlsZVBvaW50LnldO1xuXG4gICAgLy9Jbml0aWFsaXplIHRoaXMgdGlsZSdzIGZlYXR1cmUgc3RvcmFnZSBoYXNoLCBpZiBpdCBoYXNuJ3QgYWxyZWFkeSBiZWVuIGNyZWF0ZWQuICBVc2VkIGZvciB3aGVuIGZpbHRlcnMgYXJlIHVwZGF0ZWQsIGFuZCBmZWF0dXJlcyBhcmUgY2xlYXJlZCB0byBwcmVwYXJlIGZvciBhIGZyZXNoIHJlZHJhdy5cbiAgICBpZiAoIXRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc1tsYXllckN0eC5pZF0pIHtcbiAgICAgIHRoaXMuX2luaXRpYWxpemVGZWF0dXJlc0hhc2gobGF5ZXJDdHgpO1xuICAgIH1lbHNle1xuICAgICAgLy9DbGVhciB0aGlzIHRpbGUncyBwcmV2aW91c2x5IHNhdmVkIGZlYXR1cmVzLlxuICAgICAgdGhpcy5jbGVhclRpbGVGZWF0dXJlSGFzaChsYXllckN0eC5pZCk7XG4gICAgfVxuXG4gICAgdmFyIGZlYXR1cmVzID0gdnRsLnBhcnNlZEZlYXR1cmVzO1xuICAgIHZhciB0b0luZGV4ID0gW107XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGZlYXR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgdnRmID0gZmVhdHVyZXNbaV07IC8vdmVjdG9yIHRpbGUgZmVhdHVyZVxuXG4gICAgICAvKipcbiAgICAgICAqIEFwcGx5IGZpbHRlciBvbiBmZWF0dXJlIGlmIHRoZXJlIGlzIG9uZS4gRGVmaW5lZCBpbiB0aGUgb3B0aW9ucyBvYmplY3RcbiAgICAgICAqIG9mIFRpbGVMYXllci5NVlRTb3VyY2UuanNcbiAgICAgICAqL1xuICAgICAgdmFyIGZpbHRlciA9IHNlbGYub3B0aW9ucy5maWx0ZXI7XG4gICAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBpZiAoIGZpbHRlcih2dGYsIGxheWVyQ3R4KSA9PT0gZmFsc2UgKSBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGdldElERm9yTGF5ZXJGZWF0dXJlO1xuICAgICAgaWYgKHR5cGVvZiBzZWxmLm9wdGlvbnMuZ2V0SURGb3JMYXllckZlYXR1cmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZ2V0SURGb3JMYXllckZlYXR1cmUgPSBzZWxmLm9wdGlvbnMuZ2V0SURGb3JMYXllckZlYXR1cmU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnZXRJREZvckxheWVyRmVhdHVyZSA9IFV0aWwuZ2V0SURGb3JMYXllckZlYXR1cmU7XG4gICAgICB9XG4gICAgICB2YXIgdW5pcXVlSUQgPSBzZWxmLm9wdGlvbnMuZ2V0SURGb3JMYXllckZlYXR1cmUodnRmKSB8fCBpO1xuICAgICAgdmFyIG12dEZlYXR1cmUgPSBzZWxmLmZlYXR1cmVzW3VuaXF1ZUlEXTtcblxuICAgICAgLyoqXG4gICAgICAgKiBJbmRleCB0aGUgZmVhdHVyZSBieSBib3VuZGluZyBib3ggaW50byByYnVzaC5cbiAgICAgICAqL1xuICAgICAgdmFyIGJ1ZmZlciA9IDA7XG4gICAgICAvLyBhZGQgYnVmZmVyIHRvIGluZGV4IGZvciBwb2ludHMgKGlnbm9yZSBmb3Igb3RoZXIgdHlwZXMpXG4gICAgICBpZiAodnRmLnR5cGUgPT09IDEpIHsgYnVmZmVyID0gc2VsZi5vcHRpb25zLmJ1ZmZlcjsgfVxuICAgICAgdmFyIGJveCA9IGJib3godnRmLCBsYXllckN0eC50aWxlU2l6ZSwgdW5pcXVlSUQsIGJ1ZmZlcik7XG4gICAgICB0b0luZGV4LnB1c2goYm94KTtcblxuICAgICAgLyoqXG4gICAgICAgKiBVc2UgbGF5ZXJPcmRlcmluZyBmdW5jdGlvbiB0byBhcHBseSBhIHpJbmRleCBwcm9wZXJ0eSB0byBlYWNoIHZ0Zi4gIFRoaXMgaXMgZGVmaW5lZCBpblxuICAgICAgICogVGlsZUxheWVyLk1WVFNvdXJjZS5qcy4gIFVzZWQgYmVsb3cgdG8gc29ydCBmZWF0dXJlcy5ucG1cbiAgICAgICAqL1xuICAgICAgdmFyIGxheWVyT3JkZXJpbmcgPSBzZWxmLm9wdGlvbnMubGF5ZXJPcmRlcmluZztcbiAgICAgIGlmICh0eXBlb2YgbGF5ZXJPcmRlcmluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBsYXllck9yZGVyaW5nKHZ0ZiwgbGF5ZXJDdHgpOyAvL0FwcGxpZXMgYSBjdXN0b20gcHJvcGVydHkgdG8gdGhlIGZlYXR1cmUsIHdoaWNoIGlzIHVzZWQgYWZ0ZXIgd2UncmUgdGhydSBpdGVyYXRpbmcgdG8gc29ydFxuICAgICAgfVxuXG4gICAgICAvL0NyZWF0ZSBhIG5ldyBNVlRGZWF0dXJlIGlmIG9uZSBkb2Vzbid0IGFscmVhZHkgZXhpc3QgZm9yIHRoaXMgZmVhdHVyZS5cbiAgICAgIGlmICghbXZ0RmVhdHVyZSkge1xuXG4gICAgICAgIC8vR2V0IGEgc3R5bGUgZm9yIHRoZSBmZWF0dXJlIC0gc2V0IGl0IGp1c3Qgb25jZSBmb3IgZWFjaCBuZXcgTVZURmVhdHVyZVxuICAgICAgICB2YXIgc3R5bGUgPSBzZWxmLnN0eWxlKHZ0Zik7XG5cbiAgICAgICAgLy9jcmVhdGUgYSBuZXcgZmVhdHVyZVxuICAgICAgICBzZWxmLmZlYXR1cmVzW3VuaXF1ZUlEXSA9IG12dEZlYXR1cmUgPSBuZXcgTVZURmVhdHVyZShzZWxmLCB2dGYsIGxheWVyQ3R4LCB1bmlxdWVJRCwgc3R5bGUpO1xuICAgICAgICBpZiAoc3R5bGUgJiYgc3R5bGUuZHluYW1pY0xhYmVsICYmIHR5cGVvZiBzdHlsZS5keW5hbWljTGFiZWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBzZWxmLmZlYXR1cmVzV2l0aExhYmVscy5wdXNoKG12dEZlYXR1cmUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvL0FkZCB0aGUgbmV3IHBhcnQgdG8gdGhlIGV4aXN0aW5nIGZlYXR1cmVcbiAgICAgICAgbXZ0RmVhdHVyZS5hZGRUaWxlRmVhdHVyZSh2dGYsIGxheWVyQ3R4KTtcbiAgICAgIH1cblxuICAgICAgLy9Bc3NvY2lhdGUgJiBTYXZlIHRoaXMgZmVhdHVyZSB3aXRoIHRoaXMgdGlsZSBmb3IgbGF0ZXJcbiAgICAgIHNlbGYuX2NhbnZhc0lEVG9GZWF0dXJlc1tsYXllckN0eC5pZF0uZmVhdHVyZXMucHVzaChtdnRGZWF0dXJlKTtcblxuICAgIH1cbiAgICBzZWxmLl9jYW52YXNJRFRvRmVhdHVyZXNbbGF5ZXJDdHguaWRdLmluZGV4LmxvYWQodG9JbmRleCk7XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBzb3J0aW5nICh6SW5kZXgpIG9uIGZlYXR1cmUgaWYgdGhlcmUgaXMgYSBmdW5jdGlvbiBkZWZpbmVkIGluIHRoZSBvcHRpb25zIG9iamVjdFxuICAgICAqIG9mIFRpbGVMYXllci5NVlRTb3VyY2UuanNcbiAgICAgKi9cbiAgICB2YXIgbGF5ZXJPcmRlcmluZyA9IHNlbGYub3B0aW9ucy5sYXllck9yZGVyaW5nO1xuICAgIGlmIChsYXllck9yZGVyaW5nKSB7XG4gICAgICAvL1dlJ3ZlIGFzc2lnbmVkIHRoZSBjdXN0b20gekluZGV4IHByb3BlcnR5IHdoZW4gaXRlcmF0aW5nIGFib3ZlLiAgTm93IGp1c3Qgc29ydC5cbiAgICAgIHNlbGYuX2NhbnZhc0lEVG9GZWF0dXJlc1tsYXllckN0eC5pZF0uZmVhdHVyZXMgPSBzZWxmLl9jYW52YXNJRFRvRmVhdHVyZXNbbGF5ZXJDdHguaWRdLmZlYXR1cmVzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gLShiLnByb3BlcnRpZXMuekluZGV4IC0gYS5wcm9wZXJ0aWVzLnpJbmRleClcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYucmVkcmF3VGlsZShsYXllckN0eC5pZCk7XG4gIH0sXG5cbiAgc2V0U3R5bGU6IGZ1bmN0aW9uKHN0eWxlRm4pIHtcbiAgICAvLyByZWZyZXNoIHRoZSBudW1iZXIgZm9yIHRoZSBoaWdoZXN0IGNvdW50IHZhbHVlXG4gICAgLy8gdGhpcyBpcyB1c2VkIG9ubHkgZm9yIGNob3JvcGxldGhcbiAgICB0aGlzLl9oaWdoZXN0Q291bnQgPSAwO1xuXG4gICAgLy8gbG93ZXN0IGNvdW50IHNob3VsZCBub3QgYmUgMCwgc2luY2Ugd2Ugd2FudCB0byBmaWd1cmUgb3V0IHRoZSBsb3dlc3RcbiAgICB0aGlzLl9sb3dlc3RDb3VudCA9IG51bGw7XG5cbiAgICB0aGlzLnN0eWxlID0gc3R5bGVGbjtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5mZWF0dXJlcykge1xuICAgICAgdmFyIGZlYXQgPSB0aGlzLmZlYXR1cmVzW2tleV07XG4gICAgICBmZWF0LnNldFN0eWxlKHN0eWxlRm4pO1xuICAgIH1cbiAgICB2YXIgeiA9IHRoaXMubWFwLmdldFpvb20oKTtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5fdGlsZXMpIHtcbiAgICAgIHZhciBpZCA9IHogKyAnOicgKyBrZXk7XG4gICAgICB0aGlzLnJlZHJhd1RpbGUoaWQpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQXMgY291bnRzIGZvciBjaG9yb3BsZXRocyBjb21lIGluIHdpdGggdGhlIGFqYXggZGF0YSxcbiAgICogd2Ugd2FudCB0byBrZWVwIHRyYWNrIG9mIHdoaWNoIHZhbHVlIGlzIHRoZSBoaWdoZXN0XG4gICAqIHRvIGNyZWF0ZSB0aGUgY29sb3IgcmFtcCBmb3IgdGhlIGZpbGxzIG9mIHBvbHlnb25zLlxuICAgKiBAcGFyYW0gY291bnRcbiAgICovXG4gIHNldEhpZ2hlc3RDb3VudDogZnVuY3Rpb24oY291bnQpIHtcbiAgICBpZiAoY291bnQgPiB0aGlzLl9oaWdoZXN0Q291bnQpIHtcbiAgICAgIHRoaXMuX2hpZ2hlc3RDb3VudCA9IGNvdW50O1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgaGlnaGVzdCBudW1iZXIgb2YgYWxsIG9mIHRoZSBjb3VudHMgdGhhdCBoYXZlIGNvbWUgaW5cbiAgICogZnJvbSBzZXRIaWdoZXN0Q291bnQuIFRoaXMgaXMgYXNzdW1lZCB0byBiZSBzZXQgdmlhIGFqYXggY2FsbGJhY2tzLlxuICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgKi9cbiAgZ2V0SGlnaGVzdENvdW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5faGlnaGVzdENvdW50O1xuICB9LFxuXG4gIHNldExvd2VzdENvdW50OiBmdW5jdGlvbihjb3VudCkge1xuICAgIGlmICghdGhpcy5fbG93ZXN0Q291bnQgfHwgY291bnQgPCB0aGlzLl9sb3dlc3RDb3VudCkge1xuICAgICAgdGhpcy5fbG93ZXN0Q291bnQgPSBjb3VudDtcbiAgICB9XG4gIH0sXG5cbiAgZ2V0TG93ZXN0Q291bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9sb3dlc3RDb3VudDtcbiAgfSxcblxuICBzZXRDb3VudFJhbmdlOiBmdW5jdGlvbihjb3VudCkge1xuICAgIHRoaXMuc2V0SGlnaGVzdENvdW50KGNvdW50KTtcbiAgICB0aGlzLnNldExvd2VzdENvdW50KGNvdW50KTtcbiAgfSxcblxuICBmZWF0dXJlQXQ6IGZ1bmN0aW9uKHRpbGVJRCwgdGlsZVBpeGVsUG9pbnQpIHtcbiAgICBpZiAoIXRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc1t0aWxlSURdKSByZXR1cm4gbnVsbDsgLy8gYnJlYWsgb3V0XG5cbiAgICB2YXIgem9vbSA9IHRpbGVJRC5zcGxpdChcIjpcIilbMF07XG4gICAgdmFyIHggPSB0aWxlUGl4ZWxQb2ludC54O1xuICAgIHZhciB5ID0gdGlsZVBpeGVsUG9pbnQueTtcblxuICAgIHZhciBpbmRleCA9IHRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc1t0aWxlSURdLmluZGV4O1xuXG4gICAgdmFyIG1pbkRpc3RhbmNlID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgIHZhciBuZWFyZXN0ID0gbnVsbDtcbiAgICB2YXIgaiwgcGF0aHMsIGRpc3RhbmNlO1xuXG4gICAgdmFyIG1hdGNoZXMgPSBpbmRleC5zZWFyY2goW3gsIHksIHgsIHldKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hdGNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmZWF0dXJlID0gdGhpcy5mZWF0dXJlc1ttYXRjaGVzW2ldLmlkXTtcbiAgICAgIHN3aXRjaCAoZmVhdHVyZS50eXBlKSB7XG5cbiAgICAgICAgY2FzZSAxOiAvL1BvaW50IC0gY3VycmVudGx5IHJlbmRlcmVkIGFzIGNpcmN1bGFyIHBhdGhzLiAgSW50ZXJzZWN0IHdpdGggdGhhdC5cblxuICAgICAgICAgIC8vRmluZCB0aGUgcmFkaXVzIG9mIHRoZSBwb2ludC5cbiAgICAgICAgICB2YXIgcmFkaXVzID0gMztcbiAgICAgICAgICBpZiAodHlwZW9mIGZlYXR1cmUuc3R5bGUucmFkaXVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICByYWRpdXMgPSBmZWF0dXJlLnN0eWxlLnJhZGl1cyh6b29tKTsgLy9BbGxvd3MgZm9yIHNjYWxlIGRlcGVuZGVudCByZWRuZXJpbmdcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgIHJhZGl1cyA9IGZlYXR1cmUuc3R5bGUucmFkaXVzO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHBhdGhzID0gZmVhdHVyZS5nZXRQYXRoc0ZvclRpbGUodGlsZUlEKTtcbiAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcGF0aHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIC8vQnVpbGRzIGEgY2lyY2xlIG9mIHJhZGl1cyBmZWF0dXJlLnN0eWxlLnJhZGl1cyAoYXNzdW1pbmcgY2lyY3VsYXIgcG9pbnQgc3ltYm9sb2d5KS5cbiAgICAgICAgICAgIGlmKGluX2NpcmNsZShwYXRoc1tqXVswXS54LCBwYXRoc1tqXVswXS55LCByYWRpdXMsIHgsIHkpKXtcbiAgICAgICAgICAgICAgbmVhcmVzdCA9IGZlYXR1cmU7XG4gICAgICAgICAgICAgIG1pbkRpc3RhbmNlID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAyOiAvL0xpbmVTdHJpbmdcbiAgICAgICAgICBwYXRocyA9IGZlYXR1cmUuZ2V0UGF0aHNGb3JUaWxlKHRpbGVJRCk7XG4gICAgICAgICAgZm9yIChqID0gMDsgaiA8IHBhdGhzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAoZmVhdHVyZS5zdHlsZSkge1xuICAgICAgICAgICAgICB2YXIgZGlzdGFuY2UgPSB0aGlzLl9nZXREaXN0YW5jZUZyb21MaW5lKHRpbGVQaXhlbFBvaW50LCBwYXRoc1tqXSk7XG4gICAgICAgICAgICAgIHZhciB0aGlja25lc3MgPSAoZmVhdHVyZS5zZWxlY3RlZCAmJiBmZWF0dXJlLnN0eWxlLnNlbGVjdGVkID8gZmVhdHVyZS5zdHlsZS5zZWxlY3RlZC5zaXplIDogZmVhdHVyZS5zdHlsZS5zaXplKTtcbiAgICAgICAgICAgICAgaWYgKGRpc3RhbmNlIDwgdGhpY2tuZXNzIC8gMiArIHRoaXMub3B0aW9ucy5saW5lQ2xpY2tUb2xlcmFuY2UgJiYgZGlzdGFuY2UgPCBtaW5EaXN0YW5jZSkge1xuICAgICAgICAgICAgICAgIG5lYXJlc3QgPSBmZWF0dXJlO1xuICAgICAgICAgICAgICAgIG1pbkRpc3RhbmNlID0gZGlzdGFuY2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAzOiAvL1BvbHlnb25cbiAgICAgICAgICBwYXRocyA9IGZlYXR1cmUuZ2V0UGF0aHNGb3JUaWxlKHRpbGVJRCk7XG4gICAgICAgICAgZm9yIChqID0gMDsgaiA8IHBhdGhzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5faXNQb2ludEluUG9seSh0aWxlUGl4ZWxQb2ludCwgcGF0aHNbal0pKSB7XG4gICAgICAgICAgICAgIG5lYXJlc3QgPSBmZWF0dXJlO1xuICAgICAgICAgICAgICBtaW5EaXN0YW5jZSA9IDA7IC8vIHBvaW50IGlzIGluc2lkZSB0aGUgcG9seWdvbiwgc28gZGlzdGFuY2UgaXMgemVyb1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChtaW5EaXN0YW5jZSA9PSAwKSBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfSxcblxuICBjbGVhclRpbGU6IGZ1bmN0aW9uKGlkKSB7XG4gICAgLy9pZCBpcyB0aGUgZW50aXJlIHpvb206eDp5LiAgd2UganVzdCB3YW50IHg6eS5cbiAgICB2YXIgY2EgPSBpZC5zcGxpdChcIjpcIik7XG4gICAgdmFyIGNhbnZhc0lkID0gY2FbMV0gKyBcIjpcIiArIGNhWzJdO1xuICAgIGlmICh0eXBlb2YgdGhpcy5fdGlsZXNbY2FudmFzSWRdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc29sZS5lcnJvcihcInR5cGVvZiB0aGlzLl90aWxlc1tjYW52YXNJZF0gPT09ICd1bmRlZmluZWQnXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgY2FudmFzID0gdGhpcy5fdGlsZXNbY2FudmFzSWRdO1xuXG4gICAgdmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjb250ZXh0LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICB9LFxuXG4gIGNsZWFyVGlsZUZlYXR1cmVIYXNoOiBmdW5jdGlvbihjYW52YXNJRCkge1xuICAgIC8vIEdldCByaWQgb2YgYWxsIHNhdmVkIGZlYXR1cmVzXG4gICAgdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW2NhbnZhc0lEXS5mZWF0dXJlcyA9IFtdO1xuICAgIHRoaXMuX2NhbnZhc0lEVG9GZWF0dXJlc1tjYW52YXNJRF0uaW5kZXggPSByYnVzaCg5KTtcbiAgfSxcblxuICBjbGVhckxheWVyRmVhdHVyZUhhc2g6IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy5mZWF0dXJlcyA9IHt9O1xuICB9LFxuXG4gIHJlZHJhd1RpbGU6IGZ1bmN0aW9uKGNhbnZhc0lEKSB7XG4gICAgLy9GaXJzdCwgY2xlYXIgdGhlIGNhbnZhc1xuICAgIHRoaXMuY2xlYXJUaWxlKGNhbnZhc0lEKTtcblxuICAgIC8vIElmIHRoZSBmZWF0dXJlcyBhcmUgbm90IGluIHRoZSB0aWxlLCB0aGVuIHRoZXJlIGlzIG5vdGhpbmcgdG8gcmVkcmF3LlxuICAgIC8vIFRoaXMgbWF5IGhhcHBlbiBpZiB5b3UgY2FsbCByZWRyYXcgYmVmb3JlIGZlYXR1cmVzIGhhdmUgbG9hZGVkIGFuZCBpbml0aWFsbHlcbiAgICAvLyBkcmF3biB0aGUgdGlsZS5cbiAgICB2YXIgZmVhdGZlYXRzID0gdGhpcy5fY2FudmFzSURUb0ZlYXR1cmVzW2NhbnZhc0lEXTtcbiAgICBpZiAoIWZlYXRmZWF0cykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vR2V0IHRoZSBmZWF0dXJlcyBmb3IgdGhpcyB0aWxlLCBhbmQgcmVkcmF3IHRoZW0uXG4gICAgdmFyIGZlYXR1cmVzID0gZmVhdGZlYXRzLmZlYXR1cmVzO1xuXG4gICAgLy8gd2Ugd2FudCB0byBza2lwIGRyYXdpbmcgdGhlIHNlbGVjdGVkIGZlYXR1cmVzIGFuZCBkcmF3IHRoZW0gbGFzdFxuICAgIHZhciBzZWxlY3RlZEZlYXR1cmVzID0gW107XG5cbiAgICAvLyBkcmF3aW5nIGFsbCBvZiB0aGUgbm9uLXNlbGVjdGVkIGZlYXR1cmVzXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGZlYXR1cmUgPSBmZWF0dXJlc1tpXTtcbiAgICAgIGlmIChmZWF0dXJlLnNlbGVjdGVkKSB7XG4gICAgICAgIHNlbGVjdGVkRmVhdHVyZXMucHVzaChmZWF0dXJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZlYXR1cmUuZHJhdyhjYW52YXNJRCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZHJhd2luZyB0aGUgc2VsZWN0ZWQgZmVhdHVyZXMgbGFzdFxuICAgIGZvciAodmFyIGogPSAwLCBsZW4yID0gc2VsZWN0ZWRGZWF0dXJlcy5sZW5ndGg7IGogPCBsZW4yOyBqKyspIHtcbiAgICAgIHZhciBzZWxGZWF0ID0gc2VsZWN0ZWRGZWF0dXJlc1tqXTtcbiAgICAgIHNlbEZlYXQuZHJhdyhjYW52YXNJRCk7XG4gICAgfVxuICB9LFxuXG4gIGxpbmtlZExheWVyOiBmdW5jdGlvbigpIHtcbiAgICBpZih0aGlzLm12dFNvdXJjZS5sYXllckxpbmspIHtcbiAgICAgIHZhciBsaW5rTmFtZSA9IHRoaXMubXZ0U291cmNlLmxheWVyTGluayh0aGlzLm5hbWUpO1xuICAgICAgcmV0dXJuIHRoaXMubXZ0U291cmNlLmxheWVyc1tsaW5rTmFtZV07XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH0sXG5cbiAgZmVhdHVyZVdpdGhMYWJlbEFkZGVkOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgdGhpcy5mZWF0dXJlc1dpdGhMYWJlbHMucHVzaChmZWF0dXJlKTtcbiAgfVxuXG59KTtcblxuZnVuY3Rpb24gYmJveCh2dGYsIHRpbGVTaXplLCBpZCwgYnVmZmVyKSB7XG4gIHZhciBkaXZpc29yID0gdnRmLmV4dGVudCAvIHRpbGVTaXplO1xuXG4gIHZhciBtaW5YID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICB2YXIgbWF4WCA9IE51bWJlci5ORUdBVElWRV9JTkZJTklUWTtcbiAgdmFyIG1pblkgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gIHZhciBtYXhZID0gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xuICB2dGYuY29vcmRpbmF0ZXMuZm9yRWFjaChmdW5jdGlvbihjb29yZGluYXRlcykge1xuICAgIGNvb3JkaW5hdGVzLmZvckVhY2goZnVuY3Rpb24oY29vcmRpbmF0ZSkge1xuICAgICAgdmFyIHggPSBjb29yZGluYXRlLnggLyBkaXZpc29yO1xuICAgICAgdmFyIHkgPSBjb29yZGluYXRlLnkgLyBkaXZpc29yO1xuICAgICAgbWluWCA9IE1hdGgubWluKG1pblgsIHgpO1xuICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIHgpO1xuICAgICAgbWluWSA9IE1hdGgubWluKG1pblksIHkpO1xuICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIHkpO1xuICAgIH0pO1xuICB9KTtcblxuICBpZiAoYnVmZmVyID4gMCkge1xuICAgIG1pblggLT0gYnVmZmVyO1xuICAgIG1heFggKz0gYnVmZmVyO1xuICAgIG1pblkgLT0gYnVmZmVyO1xuICAgIG1heFkgKz0gYnVmZmVyO1xuICB9XG4gIHZhciBib3ggPSBbbWluWCwgbWluWSwgbWF4WCwgbWF4WV07XG4gIGJveC5pZCA9IGlkO1xuICByZXR1cm4gYm94O1xufVxuXG5cbmZ1bmN0aW9uIHJlbW92ZUxhYmVscyhzZWxmKSB7XG4gIHZhciBmZWF0dXJlcyA9IHNlbGYuZmVhdHVyZXNXaXRoTGFiZWxzO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gZmVhdHVyZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgZmVhdCA9IGZlYXR1cmVzW2ldO1xuICAgIGZlYXQucmVtb3ZlTGFiZWwoKTtcbiAgfVxuICBzZWxmLmZlYXR1cmVzV2l0aExhYmVscyA9IFtdO1xufVxuXG5mdW5jdGlvbiBpbl9jaXJjbGUoY2VudGVyX3gsIGNlbnRlcl95LCByYWRpdXMsIHgsIHkpIHtcbiAgdmFyIHNxdWFyZV9kaXN0ID0gTWF0aC5wb3coKGNlbnRlcl94IC0geCksIDIpICsgTWF0aC5wb3coKGNlbnRlcl95IC0geSksIDIpO1xuICByZXR1cm4gc3F1YXJlX2Rpc3QgPD0gTWF0aC5wb3cocmFkaXVzLCAyKTtcbn1cbi8qKlxuICogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hcml5YS9waGFudG9tanMvYmxvYi9tYXN0ZXIvZXhhbXBsZXMvd2FpdGZvci5qc1xuICpcbiAqIFdhaXQgdW50aWwgdGhlIHRlc3QgY29uZGl0aW9uIGlzIHRydWUgb3IgYSB0aW1lb3V0IG9jY3Vycy4gVXNlZnVsIGZvciB3YWl0aW5nXG4gKiBvbiBhIHNlcnZlciByZXNwb25zZSBvciBmb3IgYSB1aSBjaGFuZ2UgKGZhZGVJbiwgZXRjLikgdG8gb2NjdXIuXG4gKlxuICogQHBhcmFtIHRlc3RGeCBqYXZhc2NyaXB0IGNvbmRpdGlvbiB0aGF0IGV2YWx1YXRlcyB0byBhIGJvb2xlYW4sXG4gKiBpdCBjYW4gYmUgcGFzc2VkIGluIGFzIGEgc3RyaW5nIChlLmcuOiBcIjEgPT0gMVwiIG9yIFwiJCgnI2JhcicpLmlzKCc6dmlzaWJsZScpXCIgb3JcbiAqIGFzIGEgY2FsbGJhY2sgZnVuY3Rpb24uXG4gKiBAcGFyYW0gb25SZWFkeSB3aGF0IHRvIGRvIHdoZW4gdGVzdEZ4IGNvbmRpdGlvbiBpcyBmdWxmaWxsZWQsXG4gKiBpdCBjYW4gYmUgcGFzc2VkIGluIGFzIGEgc3RyaW5nIChlLmcuOiBcIjEgPT0gMVwiIG9yIFwiJCgnI2JhcicpLmlzKCc6dmlzaWJsZScpXCIgb3JcbiAqIGFzIGEgY2FsbGJhY2sgZnVuY3Rpb24uXG4gKiBAcGFyYW0gdGltZU91dE1pbGxpcyB0aGUgbWF4IGFtb3VudCBvZiB0aW1lIHRvIHdhaXQuIElmIG5vdCBzcGVjaWZpZWQsIDMgc2VjIGlzIHVzZWQuXG4gKi9cbmZ1bmN0aW9uIHdhaXRGb3IodGVzdEZ4LCBvblJlYWR5LCB0aW1lT3V0TWlsbGlzKSB7XG4gIHZhciBtYXh0aW1lT3V0TWlsbGlzID0gdGltZU91dE1pbGxpcyA/IHRpbWVPdXRNaWxsaXMgOiAzMDAwLCAvLzwgRGVmYXVsdCBNYXggVGltb3V0IGlzIDNzXG4gICAgc3RhcnQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSxcbiAgICBjb25kaXRpb24gPSAodHlwZW9mICh0ZXN0RngpID09PSBcInN0cmluZ1wiID8gZXZhbCh0ZXN0RngpIDogdGVzdEZ4KCkpLCAvLzwgZGVmZW5zaXZlIGNvZGVcbiAgICBpbnRlcnZhbCA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICgobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBzdGFydCA8IG1heHRpbWVPdXRNaWxsaXMpICYmICFjb25kaXRpb24pIHtcbiAgICAgICAgLy8gSWYgbm90IHRpbWUtb3V0IHlldCBhbmQgY29uZGl0aW9uIG5vdCB5ZXQgZnVsZmlsbGVkXG4gICAgICAgIGNvbmRpdGlvbiA9ICh0eXBlb2YgKHRlc3RGeCkgPT09IFwic3RyaW5nXCIgPyBldmFsKHRlc3RGeCkgOiB0ZXN0RngoKSk7IC8vPCBkZWZlbnNpdmUgY29kZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgICAgICAvLyBJZiBjb25kaXRpb24gc3RpbGwgbm90IGZ1bGZpbGxlZCAodGltZW91dCBidXQgY29uZGl0aW9uIGlzICdmYWxzZScpXG4gICAgICAgICAgY29uc29sZS5sb2coXCInd2FpdEZvcigpJyB0aW1lb3V0XCIpO1xuICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpOyAvLzwgU3RvcCB0aGlzIGludGVydmFsXG4gICAgICAgICAgdHlwZW9mIChvblJlYWR5KSA9PT0gXCJzdHJpbmdcIiA/IGV2YWwob25SZWFkeSkgOiBvblJlYWR5KCd0aW1lb3V0Jyk7IC8vPCBEbyB3aGF0IGl0J3Mgc3VwcG9zZWQgdG8gZG8gb25jZSB0aGUgY29uZGl0aW9uIGlzIGZ1bGZpbGxlZFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIENvbmRpdGlvbiBmdWxmaWxsZWQgKHRpbWVvdXQgYW5kL29yIGNvbmRpdGlvbiBpcyAndHJ1ZScpXG4gICAgICAgICAgY29uc29sZS5sb2coXCInd2FpdEZvcigpJyBmaW5pc2hlZCBpbiBcIiArIChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0KSArIFwibXMuXCIpO1xuICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpOyAvLzwgU3RvcCB0aGlzIGludGVydmFsXG4gICAgICAgICAgdHlwZW9mIChvblJlYWR5KSA9PT0gXCJzdHJpbmdcIiA/IGV2YWwob25SZWFkeSkgOiBvblJlYWR5KCdzdWNjZXNzJyk7IC8vPCBEbyB3aGF0IGl0J3Mgc3VwcG9zZWQgdG8gZG8gb25jZSB0aGUgY29uZGl0aW9uIGlzIGZ1bGZpbGxlZFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwgNTApOyAvLzwgcmVwZWF0IGNoZWNrIGV2ZXJ5IDUwbXNcbn07XG4iLCJ2YXIgVmVjdG9yVGlsZSA9IHJlcXVpcmUoJ3ZlY3Rvci10aWxlJykuVmVjdG9yVGlsZTtcbnZhciBQcm90b2J1ZiA9IHJlcXVpcmUoJ3BiZicpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgncG9pbnQtZ2VvbWV0cnknKTtcbnZhciBVdGlsID0gcmVxdWlyZSgnLi9NVlRVdGlsJyk7XG52YXIgTVZUTGF5ZXIgPSByZXF1aXJlKCcuL01WVExheWVyJyk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBMLlRpbGVMYXllci5NVlRTb3VyY2UgPSBMLlRpbGVMYXllci5DYW52YXMuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgZGVidWc6IGZhbHNlLFxuICAgIHVybDogXCJcIiwgLy9VUkwgVE8gVmVjdG9yIFRpbGUgU291cmNlLFxuICAgIGdldElERm9yTGF5ZXJGZWF0dXJlOiBmdW5jdGlvbigpIHt9LFxuICAgIHRpbGVTaXplOiAyNTYsXG4gICAgdmlzaWJsZUxheWVyczogbnVsbCxcbiAgICBidWZmZXI6IDUsXG4gICAgeGhySGVhZGVyczoge31cbiAgfSxcbiAgbGF5ZXJzOiB7fSwgLy9LZWVwIGEgbGlzdCBvZiB0aGUgbGF5ZXJzIGNvbnRhaW5lZCBpbiB0aGUgUEJGc1xuICBwcm9jZXNzZWRUaWxlczoge30sIC8vS2VlcCBhIGxpc3Qgb2YgdGlsZXMgdGhhdCBoYXZlIGJlZW4gcHJvY2Vzc2VkIGFscmVhZHlcbiAgX2V2ZW50SGFuZGxlcnM6IHt9LFxuICBfdHJpZ2dlck9uVGlsZXNMb2FkZWRFdmVudDogdHJ1ZSwgLy93aGV0aGVyIG9yIG5vdCB0byBmaXJlIHRoZSBvblRpbGVzTG9hZGVkIGV2ZW50IHdoZW4gYWxsIG9mIHRoZSB0aWxlcyBmaW5pc2ggbG9hZGluZy5cbiAgX3VybDogXCJcIiwgLy9pbnRlcm5hbCBVUkwgcHJvcGVydHlcblxuICBzdHlsZTogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgIHZhciBzdHlsZSA9IHt9O1xuXG4gICAgdmFyIHR5cGUgPSBmZWF0dXJlLnR5cGU7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlIDE6IC8vJ1BvaW50J1xuICAgICAgICBzdHlsZS5jb2xvciA9ICdyZ2JhKDQ5LDc5LDc5LDEpJztcbiAgICAgICAgc3R5bGUucmFkaXVzID0gNTtcbiAgICAgICAgc3R5bGUuc2VsZWN0ZWQgPSB7XG4gICAgICAgICAgY29sb3I6ICdyZ2JhKDI1NSwyNTUsMCwwLjUpJyxcbiAgICAgICAgICByYWRpdXM6IDZcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6IC8vJ0xpbmVTdHJpbmcnXG4gICAgICAgIHN0eWxlLmNvbG9yID0gJ3JnYmEoMTYxLDIxNywxNTUsMC44KSc7XG4gICAgICAgIHN0eWxlLnNpemUgPSAzO1xuICAgICAgICBzdHlsZS5zZWxlY3RlZCA9IHtcbiAgICAgICAgICBjb2xvcjogJ3JnYmEoMjU1LDI1LDAsMC41KScsXG4gICAgICAgICAgc2l6ZTogNFxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzogLy8nUG9seWdvbidcbiAgICAgICAgc3R5bGUuY29sb3IgPSAncmdiYSg0OSw3OSw3OSwxKSc7XG4gICAgICAgIHN0eWxlLm91dGxpbmUgPSB7XG4gICAgICAgICAgY29sb3I6ICdyZ2JhKDE2MSwyMTcsMTU1LDAuOCknLFxuICAgICAgICAgIHNpemU6IDFcbiAgICAgICAgfTtcbiAgICAgICAgc3R5bGUuc2VsZWN0ZWQgPSB7XG4gICAgICAgICAgY29sb3I6ICdyZ2JhKDI1NSwxNDAsMCwwLjMpJyxcbiAgICAgICAgICBvdXRsaW5lOiB7XG4gICAgICAgICAgICBjb2xvcjogJ3JnYmEoMjU1LDE0MCwwLDEpJyxcbiAgICAgICAgICAgIHNpemU6IDJcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gc3R5bGU7XG4gIH0sXG5cblxuICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG5cbiAgICAvL2EgbGlzdCBvZiB0aGUgbGF5ZXJzIGNvbnRhaW5lZCBpbiB0aGUgUEJGc1xuICAgIHRoaXMubGF5ZXJzID0ge307XG5cbiAgICAvLyB0aWxlcyBjdXJyZW50bHkgaW4gdGhlIHZpZXdwb3J0XG4gICAgdGhpcy5hY3RpdmVUaWxlcyA9IHt9O1xuXG4gICAgdGhpcy5fdXJsID0gdGhpcy5vcHRpb25zLnVybDtcblxuICAgIC8qKlxuICAgICAqIEZvciBzb21lIHJlYXNvbiwgTGVhZmxldCBoYXMgc29tZSBjb2RlIHRoYXQgcmVzZXRzIHRoZVxuICAgICAqIHogaW5kZXggaW4gdGhlIG9wdGlvbnMgb2JqZWN0LiBJJ20gaGF2aW5nIHRyb3VibGUgdHJhY2tpbmdcbiAgICAgKiBkb3duIGV4YWN0bHkgd2hhdCBkb2VzIHRoaXMgYW5kIHdoeSwgc28gZm9yIG5vdywgd2Ugc2hvdWxkXG4gICAgICoganVzdCBjb3B5IHRoZSB2YWx1ZSB0byB0aGlzLnpJbmRleCBzbyB3ZSBjYW4gaGF2ZSB0aGUgcmlnaHRcbiAgICAgKiBudW1iZXIgd2hlbiB3ZSBtYWtlIHRoZSBzdWJzZXF1ZW50IE1WVExheWVycy5cbiAgICAgKi9cbiAgICB0aGlzLnpJbmRleCA9IG9wdGlvbnMuekluZGV4O1xuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLnN0eWxlID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiBvcHRpb25zLnN0eWxlID09PSAnb2JqZWN0Jykge1xuICAgICAgdGhpcy5zdHlsZSA9IG9wdGlvbnMuc3R5bGU7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmFqYXhTb3VyY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuYWpheFNvdXJjZSA9IG9wdGlvbnMuYWpheFNvdXJjZTtcbiAgICB9XG5cbiAgICB0aGlzLmxheWVyTGluayA9IG9wdGlvbnMubGF5ZXJMaW5rO1xuXG4gICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuXG4gICAgdGhpcy5fdGlsZXNUb1Byb2Nlc3MgPSAwOyAvL3N0b3JlIHRoZSBtYXggbnVtYmVyIG9mIHRpbGVzIHRvIGJlIGxvYWRlZC4gIExhdGVyLCB3ZSBjYW4gdXNlIHRoaXMgY291bnQgdG8gY291bnQgZG93biBQQkYgbG9hZGluZy5cbiAgfSxcblxuICByZWRyYXc6IGZ1bmN0aW9uKHRyaWdnZXJPblRpbGVzTG9hZGVkRXZlbnQpe1xuICAgIC8vT25seSBzZXQgdG8gZmFsc2UgaWYgaXQgYWN0dWFsbHkgaXMgcGFzc2VkIGluIGFzICdmYWxzZSdcbiAgICBpZiAodHJpZ2dlck9uVGlsZXNMb2FkZWRFdmVudCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuX3RyaWdnZXJPblRpbGVzTG9hZGVkRXZlbnQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBMLlRpbGVMYXllci5DYW52YXMucHJvdG90eXBlLnJlZHJhdy5jYWxsKHRoaXMpO1xuICB9LFxuXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICBMLlRpbGVMYXllci5DYW52YXMucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcblxuICAgIG1hcC5vbignY2xpY2snLCB0aGlzLl9vbkNsaWNrLCB0aGlzKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMub25Ib3Zlcil7XG4gICAgICAgIG1hcC5vbignbW91c2Vtb3ZlJywgdGhpcy5fb25Ib3ZlciwgdGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5hZGRDaGlsZExheWVycyhtYXApO1xuXG4gICAgaWYgKHR5cGVvZiBEeW5hbWljTGFiZWwgPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICB0aGlzLmR5bmFtaWNMYWJlbCA9IG5ldyBEeW5hbWljTGFiZWwobWFwLCB0aGlzLCB7fSk7XG4gICAgfVxuICB9LFxuXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICB0aGlzLmZpcmUoJ3JlbW92ZScpO1xuICAgIHRoaXMucmVtb3ZlQ2hpbGRMYXllcnMobWFwKTtcbiAgICBtYXAub2ZmKCdjbGljaycsIHRoaXMuX29uQ2xpY2ssIHRoaXMpO1xuICAgIEwuVGlsZUxheWVyLkNhbnZhcy5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xuICAgIHRoaXMubWFwID0gbnVsbDtcbiAgfSxcblxuICBkcmF3VGlsZTogZnVuY3Rpb24oY2FudmFzLCB0aWxlUG9pbnQsIHpvb20pIHtcbiAgICB2YXIgY3R4ID0ge1xuICAgICAgaWQ6IFt6b29tLCB0aWxlUG9pbnQueCwgdGlsZVBvaW50LnldLmpvaW4oXCI6XCIpLFxuICAgICAgY2FudmFzOiBjYW52YXMsXG4gICAgICB0aWxlOiB0aWxlUG9pbnQsXG4gICAgICB6b29tOiB6b29tLFxuICAgICAgdGlsZVNpemU6IHRoaXMub3B0aW9ucy50aWxlU2l6ZVxuICAgIH07XG5cbiAgICAvL0NhcHR1cmUgdGhlIG1heCBudW1iZXIgb2YgdGhlIHRpbGVzIHRvIGxvYWQgaGVyZS4gdGhpcy5fdGlsZXNUb1Byb2Nlc3MgaXMgYW4gaW50ZXJuYWwgbnVtYmVyIHdlIHVzZSB0byBrbm93IHdoZW4gd2UndmUgZmluaXNoZWQgcmVxdWVzdGluZyBQQkZzLlxuICAgIGlmKHRoaXMuX3RpbGVzVG9Qcm9jZXNzIDwgdGhpcy5fdGlsZXNUb0xvYWQpIHRoaXMuX3RpbGVzVG9Qcm9jZXNzID0gdGhpcy5fdGlsZXNUb0xvYWQ7XG5cbiAgICB2YXIgaWQgPSBjdHguaWQgPSBVdGlsLmdldENvbnRleHRJRChjdHgpO1xuICAgIHRoaXMuYWN0aXZlVGlsZXNbaWRdID0gY3R4O1xuXG4gICAgaWYoIXRoaXMucHJvY2Vzc2VkVGlsZXNbY3R4Lnpvb21dKSB0aGlzLnByb2Nlc3NlZFRpbGVzW2N0eC56b29tXSA9IHt9O1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kZWJ1Zykge1xuICAgICAgdGhpcy5fZHJhd0RlYnVnSW5mbyhjdHgpO1xuICAgIH1cbiAgICB0aGlzLl9kcmF3KGN0eCk7XG4gIH0sXG5cbiAgc2V0T3BhY2l0eTpmdW5jdGlvbihvcGFjaXR5KSB7XG4gICAgdGhpcy5fc2V0VmlzaWJsZUxheWVyc1N0eWxlKCdvcGFjaXR5JyxvcGFjaXR5KTtcbiAgfSxcblxuICBzZXRaSW5kZXg6ZnVuY3Rpb24oekluZGV4KSB7XG4gICAgdGhpcy5fc2V0VmlzaWJsZUxheWVyc1N0eWxlKCd6SW5kZXgnLHpJbmRleCk7XG4gIH0sXG5cbiAgX3NldFZpc2libGVMYXllcnNTdHlsZTpmdW5jdGlvbihzdHlsZSwgdmFsdWUpIHtcbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLmxheWVycykge1xuICAgICAgdGhpcy5sYXllcnNba2V5XS5fdGlsZUNvbnRhaW5lci5zdHlsZVtzdHlsZV0gPSB2YWx1ZTtcbiAgICB9XG4gIH0sXG5cbiAgX2RyYXdEZWJ1Z0luZm86IGZ1bmN0aW9uKGN0eCkge1xuICAgIHZhciBtYXggPSB0aGlzLm9wdGlvbnMudGlsZVNpemU7XG4gICAgdmFyIGcgPSBjdHguY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgZy5zdHJva2VTdHlsZSA9ICcjMDAwMDAwJztcbiAgICBnLmZpbGxTdHlsZSA9ICcjRkZGRjAwJztcbiAgICBnLnN0cm9rZVJlY3QoMCwgMCwgbWF4LCBtYXgpO1xuICAgIGcuZm9udCA9IFwiMTJweCBBcmlhbFwiO1xuICAgIGcuZmlsbFJlY3QoMCwgMCwgNSwgNSk7XG4gICAgZy5maWxsUmVjdCgwLCBtYXggLSA1LCA1LCA1KTtcbiAgICBnLmZpbGxSZWN0KG1heCAtIDUsIDAsIDUsIDUpO1xuICAgIGcuZmlsbFJlY3QobWF4IC0gNSwgbWF4IC0gNSwgNSwgNSk7XG4gICAgZy5maWxsUmVjdChtYXggLyAyIC0gNSwgbWF4IC8gMiAtIDUsIDEwLCAxMCk7XG4gICAgZy5zdHJva2VUZXh0KGN0eC56b29tICsgJyAnICsgY3R4LnRpbGUueCArICcgJyArIGN0eC50aWxlLnksIG1heCAvIDIgLSAzMCwgbWF4IC8gMiAtIDEwKTtcbiAgfSxcblxuICBfZHJhdzogZnVuY3Rpb24oY3R4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4vLyAgICAvL1RoaXMgd29ya3MgdG8gc2tpcCBmZXRjaGluZyBhbmQgcHJvY2Vzc2luZyB0aWxlcyBpZiB0aGV5J3ZlIGFscmVhZHkgYmVlbiBwcm9jZXNzZWQuXG4vLyAgICB2YXIgdmVjdG9yVGlsZSA9IHRoaXMucHJvY2Vzc2VkVGlsZXNbY3R4Lnpvb21dW2N0eC5pZF07XG4vLyAgICAvL2lmIHdlJ3ZlIGFscmVhZHkgcGFyc2VkIGl0LCBkb24ndCBnZXQgaXQgYWdhaW4uXG4vLyAgICBpZih2ZWN0b3JUaWxlKXtcbi8vICAgICAgY29uc29sZS5sb2coXCJTa2lwcGluZyBmZXRjaGluZyBcIiArIGN0eC5pZCk7XG4vLyAgICAgIHNlbGYuY2hlY2tWZWN0b3JUaWxlTGF5ZXJzKHBhcnNlVlQodmVjdG9yVGlsZSksIGN0eCwgdHJ1ZSk7XG4vLyAgICAgIHNlbGYucmVkdWNlVGlsZXNUb1Byb2Nlc3NDb3VudCgpO1xuLy8gICAgICByZXR1cm47XG4vLyAgICB9XG5cbiAgICBpZiAoIXRoaXMuX3VybCkgcmV0dXJuO1xuICAgIHZhciBzcmMgPSB0aGlzLmdldFRpbGVVcmwoeyB4OiBjdHgudGlsZS54LCB5OiBjdHgudGlsZS55LCB6OiBjdHguem9vbSB9KTtcblxuICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoeGhyLnN0YXR1cyA9PSBcIjIwMFwiKSB7XG5cbiAgICAgICAgaWYoIXhoci5yZXNwb25zZSkgcmV0dXJuO1xuXG4gICAgICAgIHZhciBhcnJheUJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KHhoci5yZXNwb25zZSk7XG4gICAgICAgIHZhciBidWYgPSBuZXcgUHJvdG9idWYoYXJyYXlCdWZmZXIpO1xuICAgICAgICB2YXIgdnQgPSBuZXcgVmVjdG9yVGlsZShidWYpO1xuICAgICAgICAvLyBDaGVjayB0aGUgYXR0YWNobWVudCBzdGF0dXMgb2YgdGhlIGxheWVyLlxuICAgICAgICBpZiAoIXNlbGYubWFwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJGZXRjaGVkIHRpbGUgZm9yIHJlbW92ZWQgbWFwLlwiKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2hlY2sgdGhlIGN1cnJlbnQgbWFwIGxheWVyIHpvb20uICBJZiBmYXN0IHpvb21pbmcgaXMgb2NjdXJyaW5nLCB0aGVuIHNob3J0IGNpcmN1aXQgdGlsZXMgdGhhdCBhcmUgZm9yIGEgZGlmZmVyZW50IHpvb20gbGV2ZWwgdGhhbiB3ZSdyZSBjdXJyZW50bHkgb24uXG4gICAgICAgIGlmIChzZWxmLm1hcC5nZXRab29tKCkgIT0gY3R4Lnpvb20pIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIkZldGNoZWQgdGlsZSBmb3Igem9vbSBsZXZlbCBcIiArIGN0eC56b29tICsgXCIuIE1hcCBpcyBhdCB6b29tIGxldmVsIFwiICsgc2VsZi5tYXAuZ2V0Wm9vbSgpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5jaGVja1ZlY3RvclRpbGVMYXllcnMocGFyc2VWVCh2dCksIGN0eCk7XG4gICAgICB9XG5cbiAgICAgIC8vZWl0aGVyIHdheSwgcmVkdWNlIHRoZSBjb3VudCBvZiB0aWxlc1RvUHJvY2VzcyB0aWxlcyBoZXJlXG4gICAgICBzZWxmLnJlZHVjZVRpbGVzVG9Qcm9jZXNzQ291bnQoKTtcbiAgICB9O1xuXG4gICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwieGhyIGVycm9yOiBcIiArIHhoci5zdGF0dXMpXG4gICAgfTtcblxuICAgIHhoci5vcGVuKCdHRVQnLCBzcmMsIHRydWUpOyAvL2FzeW5jIGlzIHRydWVcbiAgICB2YXIgaGVhZGVycyA9IHNlbGYub3B0aW9ucy54aHJIZWFkZXJzO1xuICAgIGZvciAodmFyIGhlYWRlciBpbiBoZWFkZXJzKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIGhlYWRlcnNbaGVhZGVyXSk7XG4gICAgfVxuICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHhoci5zZW5kKCk7XG4gIH0sXG5cbiAgcmVkdWNlVGlsZXNUb1Byb2Nlc3NDb3VudDogZnVuY3Rpb24oKXtcbiAgICB0aGlzLl90aWxlc1RvUHJvY2Vzcy0tO1xuICAgIGlmKCF0aGlzLl90aWxlc1RvUHJvY2Vzcyl7XG4gICAgICAvL1RyaWdnZXIgZXZlbnQgbGV0dGluZyB1cyBrbm93IHRoYXQgYWxsIFBCRnMgaGF2ZSBiZWVuIGxvYWRlZCBhbmQgcHJvY2Vzc2VkIChvciA0MDQnZCkuXG4gICAgICBpZih0aGlzLl9ldmVudEhhbmRsZXJzW1wiUEJGTG9hZFwiXSkgdGhpcy5fZXZlbnRIYW5kbGVyc1tcIlBCRkxvYWRcIl0oKTtcbiAgICAgIHRoaXMuX3BiZkxvYWRlZCgpO1xuICAgIH1cbiAgfSxcblxuICBjaGVja1ZlY3RvclRpbGVMYXllcnM6IGZ1bmN0aW9uKHZ0LCBjdHgsIHBhcnNlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vQ2hlY2sgaWYgdGhlcmUgYXJlIHNwZWNpZmllZCB2aXNpYmxlIGxheWVyc1xuICAgIHZhciB2aXNpYmxlTGF5ZXJzID0gc2VsZi5vcHRpb25zLnZpc2libGVMYXllcnM7XG4gICAgaWYgKCF2aXNpYmxlTGF5ZXJzKSB7XG4gICAgICB2aXNpYmxlTGF5ZXJzID0gT2JqZWN0LmtleXModnQubGF5ZXJzKTtcbiAgICB9XG5cbiAgICB2YXIgbGF5ZXJNYXBwaW5nID0gdmlzaWJsZUxheWVycztcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2aXNpYmxlTGF5ZXJzKSkge1xuICAgICAgbGF5ZXJNYXBwaW5nID0ge307XG4gICAgICBmb3IgKHZhciBpPTA7IGkgPCB2aXNpYmxlTGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxheWVyTWFwcGluZ1t2aXNpYmxlTGF5ZXJzW2ldXSA9IHZpc2libGVMYXllcnNbaV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIga2V5IGluIGxheWVyTWFwcGluZykge1xuICAgICAgdmFyIGx5ciA9IHZ0LmxheWVyc1tsYXllck1hcHBpbmdba2V5XV07XG4gICAgICBpZiAobHlyKSB7XG4gICAgICAgIHNlbGYucHJlcGFyZU1WVExheWVycyhseXIsIGtleSwgY3R4LCBwYXJzZWQpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwcmVwYXJlTVZUTGF5ZXJzOiBmdW5jdGlvbihseXIgLGtleSwgY3R4LCBwYXJzZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoIXNlbGYubGF5ZXJzW2tleV0pIHtcbiAgICAgIC8vQ3JlYXRlIE1WVExheWVyIG9yIE1WVFBvaW50TGF5ZXIgZm9yIHVzZXJcbiAgICAgIHNlbGYubGF5ZXJzW2tleV0gPSBzZWxmLmNyZWF0ZU1WVExheWVyKGtleSwgbHlyLnBhcnNlZEZlYXR1cmVzWzBdLnR5cGUgfHwgbnVsbCk7XG4gICAgfVxuXG4gICAgaWYgKHBhcnNlZCkge1xuICAgICAgLy9XZSd2ZSBhbHJlYWR5IHBhcnNlZCBpdC4gIEdvIGdldCBjYW52YXMgYW5kIGRyYXcuXG4gICAgICBzZWxmLmxheWVyc1trZXldLmdldENhbnZhcyhjdHgsIGx5cik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYubGF5ZXJzW2tleV0ucGFyc2VWZWN0b3JUaWxlTGF5ZXIobHlyLCBjdHgpO1xuICAgIH1cblxuICB9LFxuXG4gIGNyZWF0ZU1WVExheWVyOiBmdW5jdGlvbihrZXksIHR5cGUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgZ2V0SURGb3JMYXllckZlYXR1cmU7XG4gICAgaWYgKHR5cGVvZiBzZWxmLm9wdGlvbnMuZ2V0SURGb3JMYXllckZlYXR1cmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGdldElERm9yTGF5ZXJGZWF0dXJlID0gc2VsZi5vcHRpb25zLmdldElERm9yTGF5ZXJGZWF0dXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICBnZXRJREZvckxheWVyRmVhdHVyZSA9IFV0aWwuZ2V0SURGb3JMYXllckZlYXR1cmU7XG4gICAgfVxuXG4gICAgdmFyIHN0eWxlID0gc2VsZi5zdHlsZTtcbiAgICBpZiAodHlwZW9mIHN0eWxlID09PSAnb2JqZWN0Jykge1xuICAgICAgc3R5bGUgPSBzdHlsZVtrZXldO1xuICAgIH1cblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgZ2V0SURGb3JMYXllckZlYXR1cmU6IGdldElERm9yTGF5ZXJGZWF0dXJlLFxuICAgICAgZmlsdGVyOiBzZWxmLm9wdGlvbnMuZmlsdGVyLFxuICAgICAgbGF5ZXJPcmRlcmluZzogc2VsZi5vcHRpb25zLmxheWVyT3JkZXJpbmcsXG4gICAgICBzdHlsZTogc3R5bGUsXG4gICAgICBuYW1lOiBrZXksXG4gICAgICBhc3luY2g6IHRydWUsXG4gICAgICBidWZmZXI6IHNlbGYub3B0aW9ucy5idWZmZXJcbiAgICB9O1xuXG4gICAgaWYgKHNlbGYub3B0aW9ucy56SW5kZXgpIHtcbiAgICAgIG9wdGlvbnMuekluZGV4ID0gc2VsZi56SW5kZXg7XG4gICAgfVxuXG4gICAgLy9UYWtlIHRoZSBsYXllciBhbmQgY3JlYXRlIGEgbmV3IE1WVExheWVyIG9yIE1WVFBvaW50TGF5ZXIgaWYgb25lIGRvZXNuJ3QgZXhpc3QuXG4gICAgdmFyIGxheWVyID0gbmV3IE1WVExheWVyKHNlbGYsIG9wdGlvbnMpLmFkZFRvKHNlbGYubWFwKTtcblxuICAgIHJldHVybiBsYXllcjtcbiAgfSxcblxuICBnZXRMYXllcnM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmxheWVycztcbiAgfSxcblxuICBoaWRlTGF5ZXI6IGZ1bmN0aW9uKGlkKSB7XG4gICAgaWYgKHRoaXMubGF5ZXJzW2lkXSkge1xuICAgICAgdGhpcy5fbWFwLnJlbW92ZUxheWVyKHRoaXMubGF5ZXJzW2lkXSk7XG4gICAgICB2YXIgdmlzaWJsZUxheWVycyA9IHRoaXMub3B0aW9ucy52aXNpYmxlTGF5ZXJzO1xuICAgICAgaWYgKHZpc2libGVMYXllcnMpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmlzaWJsZUxheWVycykgJiYgdmlzaWJsZUxheWVycy5pbmRleE9mKGlkKSA+IC0xKSB7XG4gICAgICAgICAgdmlzaWJsZUxheWVycy5zcGxpY2UodmlzaWJsZUxheWVycy5pbmRleE9mKGlkKSwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHZpc2libGVMYXllcnNbaWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHNob3dMYXllcjogZnVuY3Rpb24oaWQpIHtcbiAgICBpZiAodGhpcy5sYXllcnNbaWRdKSB7XG4gICAgICB0aGlzLl9tYXAuYWRkTGF5ZXIodGhpcy5sYXllcnNbaWRdKTtcbiAgICAgIHZhciB2aXNpYmxlTGF5ZXJzID0gdGhpcy5vcHRpb25zLnZpc2libGVMYXllcnM7XG4gICAgICBpZiAodmlzaWJsZUxheWVycykge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2aXNpYmxlTGF5ZXJzKSkge1xuICAgICAgICAgIHZpc2libGVMYXllcnMucHVzaChpZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmlzaWJsZUxheWVyc1tpZF0gPSBpZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvL01ha2Ugc3VyZSBtYW5hZ2VyIGxheWVyIGlzIGFsd2F5cyBpbiBmcm9udFxuICAgIHRoaXMuYnJpbmdUb0Zyb250KCk7XG4gIH0sXG5cbiAgcmVtb3ZlQ2hpbGRMYXllcnM6IGZ1bmN0aW9uKG1hcCl7XG4gICAgLy9SZW1vdmUgY2hpbGQgbGF5ZXJzIG9mIHRoaXMgZ3JvdXAgbGF5ZXJcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5sYXllcnMpIHtcbiAgICAgIHZhciBsYXllciA9IHRoaXMubGF5ZXJzW2tleV07XG4gICAgICBtYXAucmVtb3ZlTGF5ZXIobGF5ZXIpO1xuICAgIH1cbiAgfSxcblxuICBhZGRDaGlsZExheWVyczogZnVuY3Rpb24obWFwKSB7XG4gICAgdmFyIHZpc2libGVMYXllcnMgPSB0aGlzLnZpc2libGVMYXllcnM7XG4gICAgaWYgKHZpc2libGVMYXllcnMpIHtcbiAgICAgIC8vb25seSBsZXQgdGhydSB0aGUgbGF5ZXJzIGxpc3RlZCBpbiB0aGUgdmlzaWJsZUxheWVycyBhcnJheSBvciBvYmplY3RcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheSh2aXNpYmxlTGF5ZXJzKSkge1xuICAgICAgICB2aXNpYmxlTGF5ZXJzID0gT2JqZWN0LmtleXModmlzaWJsZUxheWVycyk7XG4gICAgICB9XG4gICAgICBmb3IodmFyIGk9MDsgaSA8IHZpc2libGVMYXllcnMubGVuZ3RoOyBpKyspe1xuICAgICAgICB2YXIgbGF5ZXJOYW1lID0gdmlzaWJsZUxheWVyc1tpXTtcbiAgICAgICAgdmFyIGxheWVyID0gdGhpcy5sYXllcnNbbGF5ZXJOYW1lXTtcbiAgICAgICAgaWYobGF5ZXIpe1xuICAgICAgICAgIC8vUHJvY2VlZCB3aXRoIHBhcnNpbmdcbiAgICAgICAgICBtYXAuYWRkTGF5ZXIobGF5ZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICAvL0FkZCBhbGwgbGF5ZXJzXG4gICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5sYXllcnMpIHtcbiAgICAgICAgdmFyIGxheWVyID0gdGhpcy5sYXllcnNba2V5XTtcbiAgICAgICAgLy8gbGF5ZXIgaXMgc2V0IHRvIHZpc2libGUgYW5kIGlzIG5vdCBhbHJlYWR5IG9uIG1hcFxuICAgICAgICBpZiAoIWxheWVyLl9tYXApIHtcbiAgICAgICAgICBtYXAuYWRkTGF5ZXIobGF5ZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGJpbmQ6IGZ1bmN0aW9uKGV2ZW50VHlwZSwgY2FsbGJhY2spIHtcbiAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50VHlwZV0gPSBjYWxsYmFjaztcbiAgfSxcblxuICBmZWF0dXJlQXRMYXRMbmc6IGZ1bmN0aW9uKGxhdGxuZykge1xuICAgIHJldHVybiB0aGlzLmZlYXR1cmVBdENvbnRhaW5lclBvaW50KHRoaXMubWFwLmxhdExuZ1RvQ29udGFpbmVyUG9pbnQobGF0bG5nKSk7XG4gIH0sXG5cbiAgZmVhdHVyZUF0Q29udGFpbmVyUG9pbnQ6IGZ1bmN0aW9uKGNvbnRhaW5lclBvaW50KSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZlYXR1cmVBdChjb250YWluZXJQb2ludCwgdGhpcy5sYXllcnMpO1xuICB9LFxuXG4gIF9mZWF0dXJlQXQ6IGZ1bmN0aW9uKGNvbnRhaW5lclBvaW50LCBsYXllcnMpIHtcbiAgICB2YXIgdGlsZVBvaW50ID0gdGhpcy5fZ2V0VGlsZVBvaW50KGNvbnRhaW5lclBvaW50KTtcblxuICAgIC8vIFRPRE86IFotb3JkZXJpbmc/ICBDbGlja2FibGU/XG4gICAgZm9yICh2YXIga2V5IGluIGxheWVycykge1xuICAgICAgdmFyIGxheWVyID0gbGF5ZXJzW2tleV07XG4gICAgICB2YXIgZmVhdHVyZSA9IGxheWVyLmZlYXR1cmVBdCh0aWxlUG9pbnQudGlsZUlELCB0aWxlUG9pbnQpO1xuICAgICAgaWYgKGZlYXR1cmUpIHtcbiAgICAgICAgcmV0dXJuIGZlYXR1cmU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIF9vbkhvdmVyOiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG9uSG92ZXIgPSBzZWxmLm9wdGlvbnMub25Ib3ZlcjtcbiAgICBpZiAodHlwZW9mIG9uSG92ZXIgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICBvbkhvdmVyKHNlbGYsIGV2dCk7XG4gICAgfVxuICB9LFxuXG4gIF9vbkNsaWNrOiBmdW5jdGlvbihldnQpIHtcbiAgICAvL0hlcmUsIHBhc3MgdGhlIGV2ZW50IG9uIHRvIHRoZSBjaGlsZCBNVlRMYXllciBhbmQgaGF2ZSBpdCBkbyB0aGUgaGl0IHRlc3QgYW5kIGhhbmRsZSB0aGUgcmVzdWx0LlxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb25DbGljayA9IHNlbGYub3B0aW9ucy5vbkNsaWNrO1xuICAgIHZhciBjbGlja2FibGVMYXllcnMgPSBzZWxmLm9wdGlvbnMuY2xpY2thYmxlTGF5ZXJzO1xuICAgIHZhciBsYXllcnMgPSBzZWxmLmxheWVycztcblxuICAgIC8vIFdlIG11c3QgaGF2ZSBhbiBhcnJheSBvZiBjbGlja2FibGUgbGF5ZXJzLCBvdGhlcndpc2UsIHdlIGp1c3QgcGFzc1xuICAgIC8vIHRoZSBldmVudCB0byB0aGUgcHVibGljIG9uQ2xpY2sgY2FsbGJhY2sgaW4gb3B0aW9ucy5cbiAgICBpZiAoY2xpY2thYmxlTGF5ZXJzKSB7XG4gICAgICBsYXllcnMgPSB7fTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjbGlja2FibGVMYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNsaWNrYWJsZUxheWVyc1tpXTtcbiAgICAgICAgdmFyIGxheWVyID0gc2VsZi5sYXllcnNba2V5XTtcbiAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgbGF5ZXJzW2tleV0gPSBsYXllcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBmZWF0dXJlID0gdGhpcy5fZmVhdHVyZUF0KGV2dC5jb250YWluZXJQb2ludCwgbGF5ZXJzKTtcbiAgICBpZiAoZmVhdHVyZSAmJiBmZWF0dXJlLnRvZ2dsZUVuYWJsZWQpIHtcbiAgICAgIGZlYXR1cmUudG9nZ2xlKCk7XG4gICAgfVxuXG4gICAgZXZ0LmZlYXR1cmUgPSBmZWF0dXJlO1xuICAgIGlmICh0eXBlb2Ygb25DbGljayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgb25DbGljayhldnQpO1xuICAgIH1cbiAgfSxcblxuICBzZXRGaWx0ZXI6IGZ1bmN0aW9uKGZpbHRlckZ1bmN0aW9uLCBsYXllck5hbWUpIHtcbiAgICAvL3Rha2UgaW4gYSBuZXcgZmlsdGVyIGZ1bmN0aW9uLlxuICAgIC8vUHJvcGFnYXRlIHRvIGNoaWxkIGxheWVycy5cblxuICAgIC8vQWRkIGZpbHRlciB0byBhbGwgY2hpbGQgbGF5ZXJzIGlmIG5vIGxheWVyIGlzIHNwZWNpZmllZC5cbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5sYXllcnMpIHtcbiAgICAgIHZhciBsYXllciA9IHRoaXMubGF5ZXJzW2tleV07XG5cbiAgICAgIGlmIChsYXllck5hbWUpe1xuICAgICAgICBpZihrZXkudG9Mb3dlckNhc2UoKSA9PSBsYXllck5hbWUudG9Mb3dlckNhc2UoKSl7XG4gICAgICAgICAgbGF5ZXIub3B0aW9ucy5maWx0ZXIgPSBmaWx0ZXJGdW5jdGlvbjsgLy9Bc3NpZ24gZmlsdGVyIHRvIGNoaWxkIGxheWVyLCBvbmx5IGlmIG5hbWUgbWF0Y2hlc1xuICAgICAgICAgIC8vQWZ0ZXIgZmlsdGVyIGlzIHNldCwgdGhlIG9sZCBmZWF0dXJlIGhhc2hlcyBhcmUgaW52YWxpZC4gIENsZWFyIHRoZW0gZm9yIG5leHQgZHJhdy5cbiAgICAgICAgICBsYXllci5jbGVhckxheWVyRmVhdHVyZUhhc2goKTtcbiAgICAgICAgICAvL2xheWVyLmNsZWFyVGlsZUZlYXR1cmVIYXNoKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2V7XG4gICAgICAgIGxheWVyLm9wdGlvbnMuZmlsdGVyID0gZmlsdGVyRnVuY3Rpb247IC8vQXNzaWduIGZpbHRlciB0byBjaGlsZCBsYXllclxuICAgICAgICAvL0FmdGVyIGZpbHRlciBpcyBzZXQsIHRoZSBvbGQgZmVhdHVyZSBoYXNoZXMgYXJlIGludmFsaWQuICBDbGVhciB0aGVtIGZvciBuZXh0IGRyYXcuXG4gICAgICAgIGxheWVyLmNsZWFyTGF5ZXJGZWF0dXJlSGFzaCgpO1xuICAgICAgICAvL2xheWVyLmNsZWFyVGlsZUZlYXR1cmVIYXNoKCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBUYWtlIGluIGEgbmV3IHN0eWxlIGZ1bmN0aW9uIGFuZCBwcm9wb2dhdGUgdG8gY2hpbGQgbGF5ZXJzLlxuICAgKiBJZiB5b3UgZG8gbm90IHNldCBhIGxheWVyIG5hbWUsIGl0IHJlc2V0cyB0aGUgc3R5bGUgZm9yIGFsbCBvZiB0aGUgbGF5ZXJzLlxuICAgKiBAcGFyYW0gc3R5bGVGdW5jdGlvblxuICAgKiBAcGFyYW0gbGF5ZXJOYW1lXG4gICAqL1xuICBzZXRTdHlsZTogZnVuY3Rpb24oc3R5bGVGbiwgbGF5ZXJOYW1lKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMubGF5ZXJzKSB7XG4gICAgICB2YXIgbGF5ZXIgPSB0aGlzLmxheWVyc1trZXldO1xuICAgICAgaWYgKGxheWVyTmFtZSkge1xuICAgICAgICBpZihrZXkudG9Mb3dlckNhc2UoKSA9PSBsYXllck5hbWUudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgIGxheWVyLnNldFN0eWxlKHN0eWxlRm4pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsYXllci5zZXRTdHlsZShzdHlsZUZuKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgZmVhdHVyZVNlbGVjdGVkOiBmdW5jdGlvbihtdnRGZWF0dXJlKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5tdXRleFRvZ2dsZSkge1xuICAgICAgaWYgKHRoaXMuX3NlbGVjdGVkRmVhdHVyZSkge1xuICAgICAgICB0aGlzLl9zZWxlY3RlZEZlYXR1cmUuZGVzZWxlY3QoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3NlbGVjdGVkRmVhdHVyZSA9IG12dEZlYXR1cmU7XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMub25TZWxlY3QpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vblNlbGVjdChtdnRGZWF0dXJlKTtcbiAgICB9XG4gIH0sXG5cbiAgZmVhdHVyZURlc2VsZWN0ZWQ6IGZ1bmN0aW9uKG12dEZlYXR1cmUpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLm11dGV4VG9nZ2xlICYmIHRoaXMuX3NlbGVjdGVkRmVhdHVyZSkge1xuICAgICAgdGhpcy5fc2VsZWN0ZWRGZWF0dXJlID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkRlc2VsZWN0KSB7XG4gICAgICB0aGlzLm9wdGlvbnMub25EZXNlbGVjdChtdnRGZWF0dXJlKTtcbiAgICB9XG4gIH0sXG5cbiAgX3BiZkxvYWRlZDogZnVuY3Rpb24oKSB7XG4gICAgLy9GaXJlcyB3aGVuIGFsbCB0aWxlcyBmcm9tIHRoaXMgbGF5ZXIgaGF2ZSBiZWVuIGxvYWRlZCBhbmQgZHJhd24gKG9yIDQwNCdkKS5cblxuICAgIC8vTWFrZSBzdXJlIG1hbmFnZXIgbGF5ZXIgaXMgYWx3YXlzIGluIGZyb250XG4gICAgdGhpcy5icmluZ1RvRnJvbnQoKTtcblxuICAgIC8vU2VlIGlmIHRoZXJlIGlzIGFuIGV2ZW50IHRvIGV4ZWN1dGVcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG9uVGlsZXNMb2FkZWQgPSBzZWxmLm9wdGlvbnMub25UaWxlc0xvYWRlZDtcblxuICAgIGlmIChvblRpbGVzTG9hZGVkICYmIHR5cGVvZiBvblRpbGVzTG9hZGVkID09PSAnZnVuY3Rpb24nICYmIHRoaXMuX3RyaWdnZXJPblRpbGVzTG9hZGVkRXZlbnQgPT09IHRydWUpIHtcbiAgICAgIG9uVGlsZXNMb2FkZWQodGhpcyk7XG4gICAgfVxuICAgIHNlbGYuX3RyaWdnZXJPblRpbGVzTG9hZGVkRXZlbnQgPSB0cnVlOyAvL3Jlc2V0IC0gaWYgcmVkcmF3KCkgaXMgY2FsbGVkIHdpdGggdGhlIG9wdGluYWwgJ2ZhbHNlJyBwYXJhbWV0ZXIgdG8gdGVtcG9yYXJpbHkgZGlzYWJsZSB0aGUgb25UaWxlc0xvYWRlZCBldmVudCBmcm9tIGZpcmluZy4gIFRoaXMgcmVzZXRzIGl0IGJhY2sgdG8gdHJ1ZSBhZnRlciBhIHNpbmdsZSB0aW1lIG9mIGZpcmluZyBhcyAnZmFsc2UnLlxuICB9LFxuXG4gIF9nZXRUaWxlUG9pbnQ6IGZ1bmN0aW9uKGNvbnRhaW5lclBvaW50KSB7XG4gICAgdmFyIHRpbGVTaXplID0gdGhpcy5vcHRpb25zLnRpbGVTaXplO1xuICAgIHZhciBnbG9iYWxQb2ludCA9IHRoaXMubWFwLmNvbnRhaW5lclBvaW50VG9MYXllclBvaW50KGNvbnRhaW5lclBvaW50KVxuICAgICAgLmFkZCh0aGlzLm1hcC5nZXRQaXhlbE9yaWdpbigpKTtcblxuICAgIHZhciB0aWxlSW5kZXhQb2ludCA9IGdsb2JhbFBvaW50LmRpdmlkZUJ5KHRpbGVTaXplKS5mbG9vcigpO1xuICAgIHZhciB0aWxlUG9pbnQgPSBnbG9iYWxQb2ludC5zdWJ0cmFjdCh0aWxlSW5kZXhQb2ludC5tdWx0aXBseUJ5KHRpbGVTaXplKSk7XG4gICAgdGlsZVBvaW50LnRpbGVJRCA9IFwiXCIgKyB0aGlzLm1hcC5nZXRab29tKCkgKyBcIjpcIiArIHRpbGVJbmRleFBvaW50LnggKyBcIjpcIiArIHRpbGVJbmRleFBvaW50Lnk7XG4gICAgcmV0dXJuIHRpbGVQb2ludDtcbiAgfVxuXG59KTtcblxuXG5pZiAodHlwZW9mKE51bWJlci5wcm90b3R5cGUudG9SYWQpID09PSBcInVuZGVmaW5lZFwiKSB7XG4gIE51bWJlci5wcm90b3R5cGUudG9SYWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcyAqIE1hdGguUEkgLyAxODA7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VWVCh2dCl7XG4gIGZvciAodmFyIGtleSBpbiB2dC5sYXllcnMpIHtcbiAgICB2YXIgbHlyID0gdnQubGF5ZXJzW2tleV07XG4gICAgcGFyc2VWVEZlYXR1cmVzKGx5cik7XG4gIH1cbiAgcmV0dXJuIHZ0O1xufVxuXG5mdW5jdGlvbiBwYXJzZVZURmVhdHVyZXModnRsKXtcbiAgdnRsLnBhcnNlZEZlYXR1cmVzID0gW107XG4gIHZhciBmZWF0dXJlcyA9IHZ0bC5fZmVhdHVyZXM7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciB2dGYgPSB2dGwuZmVhdHVyZShpKTtcbiAgICB2dGYuY29vcmRpbmF0ZXMgPSB2dGYubG9hZEdlb21ldHJ5KCk7XG4gICAgdnRsLnBhcnNlZEZlYXR1cmVzLnB1c2godnRmKTtcbiAgfVxuICByZXR1cm4gdnRsO1xufVxuIiwiLyoqXG4gKiBDcmVhdGVkIGJ5IE5pY2hvbGFzIEhhbGxhaGFuIDxuaGFsbGFoYW5Ac3BhdGlhbGRldi5jb20+XG4gKiAgICAgICBvbiA4LzE1LzE0LlxuICovXG52YXIgVXRpbCA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cblV0aWwuZ2V0Q29udGV4dElEID0gZnVuY3Rpb24oY3R4KSB7XG4gIHJldHVybiBbY3R4Lnpvb20sIGN0eC50aWxlLngsIGN0eC50aWxlLnldLmpvaW4oXCI6XCIpO1xufTtcblxuLyoqXG4gKiBEZWZhdWx0IGZ1bmN0aW9uIHRoYXQgZ2V0cyB0aGUgaWQgZm9yIGEgbGF5ZXIgZmVhdHVyZS5cbiAqIFNvbWV0aW1lcyB0aGlzIG5lZWRzIHRvIGJlIGRvbmUgaW4gYSBkaWZmZXJlbnQgd2F5IGFuZFxuICogY2FuIGJlIHNwZWNpZmllZCBieSB0aGUgdXNlciBpbiB0aGUgb3B0aW9ucyBmb3IgTC5UaWxlTGF5ZXIuTVZUU291cmNlLlxuICpcbiAqIEBwYXJhbSBmZWF0dXJlXG4gKiBAcmV0dXJucyB7Y3R4LmlkfCp8aWR8c3RyaW5nfGpzdHMuaW5kZXguY2hhaW4uTW9ub3RvbmVDaGFpbi5pZHxudW1iZXJ9XG4gKi9cblV0aWwuZ2V0SURGb3JMYXllckZlYXR1cmUgPSBmdW5jdGlvbihmZWF0dXJlKSB7XG4gIHJldHVybiBmZWF0dXJlLnByb3BlcnRpZXMuaWQ7XG59O1xuXG5VdGlsLmdldEpTT04gPSBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gIHZhciB4bWxodHRwID0gdHlwZW9mIFhNTEh0dHBSZXF1ZXN0ICE9PSAndW5kZWZpbmVkJyA/IG5ldyBYTUxIdHRwUmVxdWVzdCgpIDogbmV3IEFjdGl2ZVhPYmplY3QoJ01pY3Jvc29mdC5YTUxIVFRQJyk7XG4gIHhtbGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHN0YXR1cyA9IHhtbGh0dHAuc3RhdHVzO1xuICAgIGlmICh4bWxodHRwLnJlYWR5U3RhdGUgPT09IDQgJiYgc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDApIHtcbiAgICAgIHZhciBqc29uID0gSlNPTi5wYXJzZSh4bWxodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICBjYWxsYmFjayhudWxsLCBqc29uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2soIHsgZXJyb3I6IHRydWUsIHN0YXR1czogc3RhdHVzIH0gKTtcbiAgICB9XG4gIH07XG4gIHhtbGh0dHAub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICB4bWxodHRwLnNlbmQoKTtcbn07XG4iLCIvKipcbiAqIENyZWF0ZWQgYnkgTmljaG9sYXMgSGFsbGFoYW4gPG5oYWxsYWhhbkBzcGF0aWFsZGV2LmNvbT5cbiAqICAgICAgIG9uIDcvMzEvMTQuXG4gKi9cbnZhciBVdGlsID0gcmVxdWlyZSgnLi4vTVZUVXRpbCcpO1xubW9kdWxlLmV4cG9ydHMgPSBTdGF0aWNMYWJlbDtcblxuZnVuY3Rpb24gU3RhdGljTGFiZWwobXZ0RmVhdHVyZSwgY3R4LCBsYXRMbmcsIHN0eWxlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5tdnRGZWF0dXJlID0gbXZ0RmVhdHVyZTtcbiAgdGhpcy5tYXAgPSBtdnRGZWF0dXJlLm1hcDtcbiAgdGhpcy56b29tID0gY3R4Lnpvb207XG4gIHRoaXMubGF0TG5nID0gbGF0TG5nO1xuICB0aGlzLnNlbGVjdGVkID0gZmFsc2U7XG5cbiAgaWYgKG12dEZlYXR1cmUubGlua2VkRmVhdHVyZSkge1xuICAgIHZhciBsaW5rZWRGZWF0dXJlID0gbXZ0RmVhdHVyZS5saW5rZWRGZWF0dXJlKCk7XG4gICAgaWYgKGxpbmtlZEZlYXR1cmUgJiYgbGlua2VkRmVhdHVyZS5zZWxlY3RlZCkge1xuICAgICAgc2VsZi5zZWxlY3RlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgaW5pdChzZWxmLCBtdnRGZWF0dXJlLCBjdHgsIGxhdExuZywgc3R5bGUpXG59XG5cbmZ1bmN0aW9uIGluaXQoc2VsZiwgbXZ0RmVhdHVyZSwgY3R4LCBsYXRMbmcsIHN0eWxlKSB7XG4gIHZhciBhamF4RGF0YSA9IG12dEZlYXR1cmUuYWpheERhdGE7XG4gIHZhciBzdHkgPSBzZWxmLnN0eWxlID0gc3R5bGUuc3RhdGljTGFiZWwobXZ0RmVhdHVyZSwgYWpheERhdGEpO1xuICB2YXIgaWNvbiA9IHNlbGYuaWNvbiA9IEwuZGl2SWNvbih7XG4gICAgY2xhc3NOYW1lOiBzdHkuY3NzQ2xhc3MgfHwgJ2xhYmVsLWljb24tdGV4dCcsXG4gICAgaHRtbDogc3R5Lmh0bWwsXG4gICAgaWNvblNpemU6IHN0eS5pY29uU2l6ZSB8fCBbNTAsNTBdXG4gIH0pO1xuXG4gIHNlbGYubWFya2VyID0gTC5tYXJrZXIobGF0TG5nLCB7aWNvbjogaWNvbn0pLmFkZFRvKHNlbGYubWFwKTtcblxuICBpZiAoc2VsZi5zZWxlY3RlZCkge1xuICAgIHNlbGYubWFya2VyLl9pY29uLmNsYXNzTGlzdC5hZGQoc2VsZi5zdHlsZS5jc3NTZWxlY3RlZENsYXNzIHx8ICdsYWJlbC1pY29uLXRleHQtc2VsZWN0ZWQnKTtcbiAgfVxuXG4gIHNlbGYubWFya2VyLm9uKCdjbGljaycsIHNlbGYudG9nZ2xlLCBzZWxmKTtcblxuICBzZWxmLm1hcC5vbignem9vbWVuZCcsIHRoaXMuX29uWm9vbUVuZCwgdGhpcyk7XG59XG5cblxuU3RhdGljTGFiZWwucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5zZWxlY3RlZCkge1xuICAgIHRoaXMuZGVzZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNlbGVjdCgpO1xuICB9XG59O1xuXG5TdGF0aWNMYWJlbC5wcm90b3R5cGUuc2VsZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2VsZWN0ZWQgPSB0cnVlO1xuICB0aGlzLm1hcmtlci5faWNvbi5jbGFzc0xpc3QuYWRkKHRoaXMuc3R5bGUuY3NzU2VsZWN0ZWRDbGFzcyB8fCAnbGFiZWwtaWNvbi10ZXh0LXNlbGVjdGVkJyk7XG4gIHZhciBsaW5rZWRGZWF0dXJlID0gdGhpcy5tdnRGZWF0dXJlLmxpbmtlZEZlYXR1cmUoKTtcbiAgaWYgKCFsaW5rZWRGZWF0dXJlLnNlbGVjdGVkKSBsaW5rZWRGZWF0dXJlLnNlbGVjdCgpO1xufTtcblxuU3RhdGljTGFiZWwucHJvdG90eXBlLmRlc2VsZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcbiAgdGhpcy5tYXJrZXIuX2ljb24uY2xhc3NMaXN0LnJlbW92ZSh0aGlzLnN0eWxlLmNzc1NlbGVjdGVkQ2xhc3MgfHwgJ2xhYmVsLWljb24tdGV4dC1zZWxlY3RlZCcpO1xuICB2YXIgbGlua2VkRmVhdHVyZSA9IHRoaXMubXZ0RmVhdHVyZS5saW5rZWRGZWF0dXJlKCk7XG4gIGlmIChsaW5rZWRGZWF0dXJlLnNlbGVjdGVkKSBsaW5rZWRGZWF0dXJlLmRlc2VsZWN0KCk7XG59O1xuXG5TdGF0aWNMYWJlbC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5tYXAgfHwgIXRoaXMubWFya2VyKSByZXR1cm47XG4gIHRoaXMubWFwLm9mZignem9vbWVuZCcsIHRoaXMuX29uWm9vbUVuZCwgdGhpcyk7XG4gIHRoaXMubWFwLnJlbW92ZUxheWVyKHRoaXMubWFya2VyKTtcbn07XG5cblN0YXRpY0xhYmVsLnByb3RvdHlwZS5fb25ab29tRW5kID0gZnVuY3Rpb24oKSB7XG4gIHZhciBuZXdab29tID0gZS50YXJnZXQuZ2V0Wm9vbSgpO1xuICBpZiAodGhpcy56b29tICE9PSBuZXdab29tKSB7XG4gICAgdGhpcy5yZW1vdmUoKTtcbiAgfVxufVxuIiwiLypcbiAqIEwuQ29udHJvbC5MYXllcnMgaXMgYSBjb250cm9sIHRvIGFsbG93IHVzZXJzIHRvIHN3aXRjaCBiZXR3ZWVuIGRpZmZlcmVudCBsYXllcnMgb24gdGhlIG1hcC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuQ29udHJvbC5NVlRMYXllcnMgPSBMLkNvbnRyb2wuTGF5ZXJzLmV4dGVuZCh7XG5cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKGJhc2VMYXllcnMsIG92ZXJsYXlzLCBvcHRpb25zKSB7XG5cdFx0TC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgICAgIC8vIE1hcCBmcm9tIHZlY3RvciBsYXllciBuYW1lIHRvIHByZXNlbnRlZCBuYW1lIGluIHRvZ2dsZVxuICAgICAgICB0aGlzLl9sYXllck5hbWVzID0gdGhpcy5vcHRpb25zLmxheWVyTmFtZXMgfHwge307XG5cdFx0dGhpcy5fbGF5ZXJzID0ge307XG5cdFx0dGhpcy5fbGFzdFpJbmRleCA9IDA7XG5cdFx0dGhpcy5faGFuZGxpbmdDbGljayA9IGZhbHNlO1xuXG5cdFx0Zm9yICh2YXIgaSBpbiBiYXNlTGF5ZXJzKSB7XG5cdFx0XHR0aGlzLmFkZEJhc2VMYXllcihiYXNlTGF5ZXJzW2ldLCBpKTtcblx0XHR9XG5cblx0XHRmb3IgKGkgaW4gb3ZlcmxheXMpIHtcblx0XHRcdHRoaXMuYWRkTVZUTGF5ZXIob3ZlcmxheXNbaV0sIGkpO1xuXHRcdH1cblx0fSxcblxuXHRhZGRNVlRMYXllcjogZnVuY3Rpb24gKGxheWVyLCBuYW1lKSB7XG5cbiAgICAgICAgdmFyIG9uVGlsZUxvYWQgPSBmdW5jdGlvbihtdnRTcmMpe1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG12dFNyYy5nZXRMYXllcnMoKSl7XG4gICAgICAgICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9sYXllck5hbWVzW2tleV0gfHwga2V5O1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkT3ZlcmxheShtdnRTcmMubGF5ZXJzW2tleV0sIG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgbGF5ZXIub3B0aW9ucy5vblRpbGVzTG9hZGVkID0gb25UaWxlTG9hZC5iaW5kKHRoaXMpO1xuXHRcdHJldHVybiB0aGlzLl91cGRhdGUoKTtcblx0fSxcblxuXHRfb25JbnB1dENsaWNrOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGlucHV0cyA9IHRoaXMuX2Zvcm0uZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2lucHV0JyksXG5cdFx0ICAgIGlucHV0LCBsYXllciwgaGFzTGF5ZXI7XG5cdFx0dmFyIGFkZGVkTGF5ZXJzID0gW10sXG5cdFx0ICAgIHJlbW92ZWRMYXllcnMgPSBbXTtcblxuXHRcdHRoaXMuX2hhbmRsaW5nQ2xpY2sgPSB0cnVlO1xuXG5cdFx0Zm9yICh2YXIgaSA9IGlucHV0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0aW5wdXQgPSBpbnB1dHNbaV07XG5cdFx0XHRsYXllciA9IHRoaXMuX2xheWVyc1tpbnB1dC5sYXllcklkXS5sYXllcjtcblx0XHRcdGhhc0xheWVyID0gdGhpcy5fbWFwLmhhc0xheWVyKGxheWVyKTtcblxuXHRcdFx0aWYgKGlucHV0LmNoZWNrZWQgJiYgIWhhc0xheWVyKSB7XG5cdFx0XHRcdGFkZGVkTGF5ZXJzLnB1c2gobGF5ZXIpO1xuXG5cdFx0XHR9IGVsc2UgaWYgKCFpbnB1dC5jaGVja2VkICYmIGhhc0xheWVyKSB7XG5cdFx0XHRcdHJlbW92ZWRMYXllcnMucHVzaChsYXllcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQnVnZml4IGlzc3VlIDIzMTg6IFNob3VsZCByZW1vdmUgYWxsIG9sZCBsYXllcnMgYmVmb3JlIHJlYWRkaW5nIG5ldyBvbmVzXG5cdFx0Zm9yIChpID0gMDsgaSA8IHJlbW92ZWRMYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBybCA9IHJlbW92ZWRMYXllcnNbaV07XG5cbiAgICAgICAgICAgIC8vIElmIHdlJ3JlIHJlbW92aW5nIGEgdmVjdG9yIGxheWVyXG4gICAgICAgICAgICBpZiAocmwubXZ0U291cmNlKXtcbiAgICAgICAgICAgICAgICBybC5tdnRTb3VyY2UuaGlkZUxheWVyKHJsLm5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXAucmVtb3ZlTGF5ZXIocmVtb3ZlZExheWVyc1tpXSk7XG4gICAgICAgICAgICB9XG5cdFx0fVxuXHRcdGZvciAoaSA9IDA7IGkgPCBhZGRlZExheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGFsID0gYWRkZWRMYXllcnNbaV07XG5cbiAgICAgICAgICAgIC8vIElmIHdlJ3JlIGFkZGluZyBhIHZlY3RvciBsYXllclxuICAgICAgICAgICAgaWYgKGFsLm12dFNvdXJjZSl7XG4gICAgICAgICAgICAgICAgYWwubXZ0U291cmNlLnNob3dMYXllcihhbC5uYW1lKTtcbiAgICAgICAgICAgICAgICBhbC5tdnRTb3VyY2UucmVkcmF3KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hcC5hZGRMYXllcihhZGRlZExheWVyc1tpXSk7XG4gICAgICAgICAgICB9XG5cdFx0fVxuXG5cdFx0dGhpcy5faGFuZGxpbmdDbGljayA9IGZhbHNlO1xuXHRcdHRoaXMuX3JlZm9jdXNPbk1hcCgpO1xuXHR9LFxufSk7XG5cbkwuY29udHJvbC5tdnRMYXllcnMgPSBmdW5jdGlvbiAoYmFzZUxheWVycywgb3ZlcmxheXMsIG9wdGlvbnMpIHtcblx0cmV0dXJuIG5ldyBMLkNvbnRyb2wuTVZUTGF5ZXJzKGJhc2VMYXllcnMsIG92ZXJsYXlzLCBvcHRpb25zKTtcbn07XG5cbkwuRG9tVXRpbC5lbXB0eSA9IGZ1bmN0aW9uIChlbCkge1xuICAgIHdoaWxlIChlbC5maXJzdENoaWxkKSB7XG4gICAgICAgIGVsLnJlbW92ZUNoaWxkKGVsLmZpcnN0Q2hpbGQpO1xuICAgIH1cbn07XG5cblxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQsIFNwYXRpYWwgRGV2ZWxvcG1lbnQgSW50ZXJuYXRpb25hbFxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBTb3VyY2UgY29kZSBjYW4gYmUgZm91bmQgYXQ6XG4gKiBodHRwczovL2dpdGh1Yi5jb20vU3BhdGlhbFNlcnZlci9MZWFmbGV0Lk1hcGJveFZlY3RvclRpbGVcbiAqXG4gKiBAbGljZW5zZSBJU0NcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHt9O1xubW9kdWxlLmV4cG9ydHMuTVZUU291cmNlID0gcmVxdWlyZSgnLi9NVlRTb3VyY2UnKTtcbm1vZHVsZS5leHBvcnRzLkNvbnRyb2wgPSB7XG4gICAgTVZUTGF5ZXJzOiByZXF1aXJlKFwiLi9jb250cm9sL0NvbnRyb2wuTVZUTGF5ZXJzXCIpXG59O1xuIl19
