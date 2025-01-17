// Copyright (c) 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef NET_QUICHE_PLATFORM_IMPL_QUICHE_STACK_TRACE_IMPL_H_
#define NET_QUICHE_PLATFORM_IMPL_QUICHE_STACK_TRACE_IMPL_H_


namespace quiche {

inline std::string QuicheStackTraceImpl() {
  return std::string("no stack trace implemented");
  // base::debug::StackTrace().ToString();
}

}  // namespace quic

#endif  // NET_QUIC_PLATFORM_IMPL_QUIC_STACK_TRACE_IMPL_H_