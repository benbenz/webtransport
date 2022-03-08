// Copyright (c) 2022 Marten Richter or other contributers (see commit). All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { getRoot } from 'bindings'
import { createRequire } from 'module'
import { ReadableStream, WritableStream } from 'node:stream/web'

const require = createRequire(import.meta.url)
let wtpath = '../build/Release/webtransport.node'
if (process.env.NODE_ENV !== 'production') {
  wtpath = '../build/Debug/webtransport.node'
}
const wtrouter = require(wtpath)

class Http3WTStream {
  constructor(args) {
    this.id = args.id
    this.objint = args.object
    this.parentid = args.parentid
    this.bidirectional = args.bidirectional
    this.incoming = args.incoming

    this.writeChunksRes = []
    this.writeChunksRej = []

    if (this.bidirectional || this.incoming) {
      this.readable = new ReadableStream({
        start: async (controller) => {
          this.readableController = controller
          this.objint.startReading()
        },
        pull: async (controller) => {
          this.objint.startReading()
        },
        cancel: (controller) => {
          this.objint.closeStream()
        }
      })
    }
    if (this.bidirectional || !this.incoming) {
      this.writable = new WritableStream({
        start: async (controller) => {
          this.writableController = controller
        },
        write: (chunk, controller) => {
          if (chunk instanceof Uint8Array) {
            const ret = new Promise((res, rej) => {
              this.writeChunksRes.push(res)
              this.writeChunksRej.push(rej)
            })
            this.objint.writeChunk(chunk)
            return ret
          } else throw new Error('chunk is not of instanceof Uint8Array ')
        },
        close: (controller) => {
          this.objint.closeStream()
        }
      })
    }
  }

  onStreamClosed(args) {
    if (this.readable) this.readableController.close()
    for (const rej in this.writeChunksRej) rej()
    this.writeChunksRej = []
    this.writeChunksRes = []
  }

  onStreamRead(args) {
    if (args.data && !this.readableclosed) {
      this.readableController.enqueue(args.data)
      if (this.readableController.desiredSize < 0) this.objint.stopReading()
    }
    if (args.fin) {
      this.readableController.close()
      this.readableclosed = true
    }
  }

  onStreamWrite(args) {
    if (args.success) {
      const front = this.writeChunksRes.shift()
      this.writeChunksRej.shift()
      front()
    } else {
      const front = this.writeChunksRej.shift()
      this.writeChunksRes.shift()
      front('writeChunk failed')
    }
  }
}

class Http3WTSession {
  constructor(args) {
    this.id = args.id
    this.objint = args.object

    this.ready = new Promise((res, rej) => {
      this.readyResolve = res
      this.readyReject = rej
    })
    this.closed = new Promise((res, rej) => {
      this.closedResolve = res
      this.closedReject = rej
    })
    this.streams = {}

    this.incomingBidirectionalStreams = new ReadableStream({
      start: async (controller) => {
        this.incomBiDiController = controller
      }
    })

    this.incomingUnidirectionalStreams = new ReadableStream({
      start: async (controller) => {
        this.incomUniDiController = controller
      }
    })

    this.datagrams = {}
    this.datagrams.readable = new ReadableStream({
      start: async (controller) => {
        this.incomDatagramController = controller
      }
    })
    this.writeDatagramRes = []
    this.writeDatagramRej = []
    this.datagrams.writable = new WritableStream({
      start: async (controller) => {
        this.outgoDatagramController = controller
      },
      write: (chunk, controller) => {
        if (chunk instanceof Uint8Array) {
          const ret = new Promise((res, rej) => {
            this.writeDatagramRes.push(res)
            this.writeDatagramRej.push(rej)
          })
          this.objint.writeDatagram(chunk)
          return ret
        } else throw new Error('chunk is not of type Uint8Array')
      },
      close: (controller) => {
        // do nothing
      }
    })

    this.resolveBiDi = []
    this.resolveUniDi = []
    this.rejectBiDi = []
    this.rejectUniDi = []
  }

  createBidirectionalStream() {
    const prom = new Promise((res, rej) => {
      this.resolveBiDi.push(res)
      this.rejectBiDi.push(rej)
    })
    this.objint.orderBidiStream()
    return prom
  }

  createUnidirectionalStream() {
    const prom = new Promise((res, rej) => {
      this.resolveUniDi.push(res)
      this.rejectUniDi.push(rej)
    })
    this.objint.orderUnidiStream()
    return prom
  }

  onReady(error) {
    if (this.readyResolve) this.readyResolve()
    delete this.readyResolve
  }

  onClose(errorcode, error) {
    delete this.objint // not valid any more
    for (const rej in this.rejectBiDi) rej()
    for (const rej in this.rejectUniDi) rej()
    for (const rej in this.writeDatagramRej) rej()
    this.writeDatagramRej = []
    this.writeDatagramRes = []
    this.resolveBiDi = []
    this.resolveUniDi = []
    this.rejectBiDi = []
    this.rejectUniDi = []

    if (this.closedResolve) this.closedResolve(errorcode)
  }
  onStream(args) {
    const strobj = new Http3WTStream({
      id: args.streamid,
      object: args.object,
      parentid: args.id,
      bidirectional: args.bidirectional,
      incoming: args.incoming
    })
    this.streams[args.streamid] = strobj
    if (args.incoming) {
      if (args.bidirectional) {
        this.incomBiDiController.enqueue(strobj)
      } else {
        this.incomUniDiController.enqueue(strobj.readable)
      }
    } else {
      if (args.bidirectional) {
        if (this.resolveBiDi.length === 0)
          throw new Error('Got bidirectional stream without asking for it')
        this.rejectBiDi.shift()
        const curres = this.resolveBiDi.shift()
        curres(strobj)
      } else {
        if (this.resolveUniDi.length === 0)
          throw new Error('Got unidirectional stream without asking for it')
        this.rejectUniDi.shift()
        const curres = this.resolveUniDi.shift()
        curres(strobj.writable)
      }
    }
  }
  onStreamClosed(args) {
    if (this.streams[args.streamid]) {
      this.streams[args.streamid].onStreamClosed(args)
      delete this.streams[args.streamid]
    } else throw new Error('Unknown stream in streamRead')
  }

  onStreamRead(args) {
    if (this.streams[args.streamid]) {
      this.streams[args.streamid].onStreamRead(args)
    } else throw new Error('Unknown stream in streamRead')
  }

  onStreamWrite(args) {
    if (this.streams[args.streamid]) {
      this.streams[args.streamid].onStreamWrite(args)
    } else throw new Error('Unknown stream in streamWrite')
  }

  onDatagramReceived(args) {
    this.incomDatagramController.enqueue(args.datagram)
  }

  onDatagramSend(args) {
    this.writeDatagramRej.shift()
    const res = this.writeDatagramRes.shift()
    res()
  }
}

export class Http3Server {
  constructor(args) {
    this.serverCallback = this.serverCallback.bind(this)
    this.serverInt = wtrouter.Http3Server(args, this.serverCallback)

    this.visitors = {}

    this.sessionStreams = {}
    this.sessionController = {}
  }

  serverCallback(args) {
    // console.log('incoming callback', args)
    if (args.purpose && args.id) {
      switch (args.purpose) {
        case 'Http3WTSessionVisitor':
          {
            // create Http3 Visitor
            if (args.object) {
              const sesobj = new Http3WTSession({
                id: args.id,
                object: args.object
              })
              this.visitors[args.id] = sesobj
              if (this.sessionController[args.path])
                this.sessionController[args.path].enqueue(sesobj)
            } else throw new Error('Http3WTSessionVisitor')
          }
          break
        case 'SessionReady':
          {
            if (this.visitors[args.id]) this.visitors[args.id].onReady()
          }
          break
        case 'SessionClose':
          {
            if (this.visitors[args.id])
              this.visitors[args.id].onClose(args.errorcode, args.error)
            delete this.visitors[args.id]
          }
          break
        case 'DatagramReceived':
          {
            if (
              args.id &&
              this.visitors[args.id] &&
              args.hasOwnProperty('datagram')
            )
              this.visitors[args.id].onDatagramReceived(args)
          }
          break
        case 'DatagramSend':
          {
            if (args.id && this.visitors[args.id])
              this.visitors[args.id].onDatagramSend(args)
          }
          break
        case 'Http3WTStreamVisitor':
          {
            if (
              this.visitors[args.id] &&
              args.streamid &&
              args.id &&
              args.hasOwnProperty('bidirectional') &&
              args.hasOwnProperty('incoming')
            ) {
              this.visitors[args.id].onStream(args)
            } else throw new Error('Malformed Http3WTStreamVisitor')
          }
          break
        case 'StreamClosed':
          {
            if (this.visitors[args.id] && args.streamid && args.id) {
              this.visitors[args.id].onStreamClosed(args)
            } else throw new Error('Malformed StreamClosed')
          }
          break
        case 'StreamRead':
          {
            if (
              this.visitors[args.id] &&
              args.streamid &&
              args.id &&
              args.hasOwnProperty('data')
            ) {
              this.visitors[args.id].onStreamRead(args)
            } else throw new Error('Malformed StreamRead')
          }
          break
        case 'StreamWrite':
          {
            if (this.visitors[args.id] && args.streamid && args.id) {
              this.visitors[args.id].onStreamWrite(args)
            } else throw new Error('Malformed StreamWrite')
          }
          break
        default:
          console.log('unknown purpose')
      }
    }
  }

  startServer() {
    this.serverInt.startServer()
  }

  destroy() {
    for (let i in this.sessionController) {
      i.close() // inform the controller, that we are closing
    }
    this.serverInt.Destroy() // destroy the server process
  }

  sessionStream(path) {
    if (path in this.sessionStreams) {
      return this.sessionsStreams[path]
    }
    this.sessionStreams[path] = new ReadableStream({
      start: async (controller) => {
        this.sessionController[path] = controller
      }
    })
    this.serverInt.addPath(path)
    return this.sessionStreams[path]
  }
}