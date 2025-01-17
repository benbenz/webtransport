// from envoy so LICENSE.envoy applies
#ifndef NET_QUICHE_PLATFORM_IMPL_QUIC_HOSTNAME_UTILS_IMPL_H_
#define NET_QUICHE_PLATFORM_IMPL_QUIC_HOSTNAME_UTILS_IMPL_H_

// NOLINT(namespace-envoy)
//
// This file is part of the QUICHE platform implementation, and is not to be
// consumed or referenced directly by other Envoy code. It serves purely as a
// porting layer for QUICHE.

#include "absl/strings/string_view.h"
#include "quic/platform/api/quic_export.h"

namespace quiche {

class QUIC_EXPORT_PRIVATE QuicheHostnameUtilsImpl {
public:
  // Returns true if the sni is valid, false otherwise.
  //  (1) disallow IP addresses;
  //  (2) check that the hostname contains valid characters only; and
  //  (3) contains at least one dot.
  // NOTE(wub): Only (3) is implemented for now.
  // NOLINTNEXTLINE(readability-identifier-naming)
  static bool IsValidSNI(absl::string_view sni);

  // Normalize a hostname:
  //  (1) Canonicalize it, similar to what Chromium does in
  //  https://cs.chromium.org/chromium/src/net/base/url_util.h?q=net::CanonicalizeHost
  //  (2) Convert it to lower case.
  //  (3) Remove the trailing '.'.
  // WARNING: May mutate |hostname| in place.
  // NOTE(wub): Only (2) and (3) are implemented for now.
  // NOLINTNEXTLINE(readability-identifier-naming)
  static std::string NormalizeHostname(absl::string_view hostname);

private:
  QuicheHostnameUtilsImpl() = delete;
};

} // namespace quic


#endif  // NET_QUIC_PLATFORM_IMPL_QUIC_HOSTNAME_UTILS_IMPL_H_