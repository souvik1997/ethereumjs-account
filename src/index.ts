import * as rlp from 'rlp'

const ethUtil = require('ethereumjs-util')
const Buffer = require('safe-buffer').Buffer

interface TrieGetCb {
  (err: any, value: Buffer | null): void
}
interface TriePutCb {
  (err?: any): void
}

interface TrieGetRootCb {
  (err: any, value: Buffer): void
}

interface TrieCopyCb {
  (err: any, value: Trie): void
}

interface Trie {
  getRoot(cb: TrieGetRootCb): void
  setRoot(key: Buffer): void
  copy(cb: TrieCopyCb): Trie
  getRaw(key: Buffer, cb: TrieGetCb): void
  putRaw(key: Buffer | string, value: Buffer, cb: TriePutCb): void
  get(key: Buffer | string, cb: TrieGetCb): void
  put(key: Buffer | string, value: Buffer | string, cb: TriePutCb): void
}

export default class Account {
  public nonce!: Buffer
  public balance!: Buffer
  public stateRoot!: Buffer
  public codeHash!: Buffer

  constructor(data?: any) {
    const fields = [
      {
        name: 'nonce',
        default: Buffer.alloc(0),
      },
      {
        name: 'balance',
        default: Buffer.alloc(0),
      },
      {
        name: 'stateRoot',
        length: 32,
        default: ethUtil.KECCAK256_RLP,
      },
      {
        name: 'codeHash',
        length: 32,
        default: ethUtil.KECCAK256_NULL,
      },
    ]

    ethUtil.defineProperties(this, fields, data)
  }

  serialize(): Buffer {
    return rlp.encode([this.nonce, this.balance, this.stateRoot, this.codeHash])
  }

  isContract(): boolean {
    return this.codeHash.toString('hex') !== ethUtil.KECCAK256_NULL_S
  }

  getCode(trie: Trie, cb: TrieGetCb): void {
    if (!this.isContract()) {
      cb(null, Buffer.alloc(0))
      return
    }

    trie.getRaw(this.codeHash, cb)
  }

  setCode(trie: Trie, code: Buffer, cb: (err: any, codeHash: Buffer) => void): void {
    this.codeHash = ethUtil.keccak256(code)

    if (this.codeHash.toString('hex') === ethUtil.KECCAK256_NULL_S) {
      cb(null, Buffer.alloc(0))
      return
    }

    trie.putRaw(this.codeHash, code, (err: any) => {
      cb(err, this.codeHash)
    })
  }

  getStorage(trie: Trie, key: Buffer | string, cb: TrieGetCb) {
    trie.copy((err: any, trieCopy: Trie) => {
      trieCopy.setRoot(this.stateRoot)
      trieCopy.get(key, cb)
    })

  }

  setStorage(trie: Trie, key: Buffer | string, val: Buffer | string, cb: () => void) {
    trie.copy((err: any, trieCopy: Trie) => {
      trieCopy.setRoot(this.stateRoot)
      trieCopy.put(key, val, (err: any) => {
        if (err) return cb()
        trieCopy.getRoot((err: any, newRoot: Buffer) => {
          this.stateRoot = newRoot
          cb()
        })
      })
    })

  }

  isEmpty() {
    return (
      this.balance.toString('hex') === '' &&
      this.nonce.toString('hex') === '' &&
      this.stateRoot.toString('hex') === ethUtil.KECCAK256_RLP_S &&
      this.codeHash.toString('hex') === ethUtil.KECCAK256_NULL_S
    )
  }
}
