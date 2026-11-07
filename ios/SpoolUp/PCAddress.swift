import Foundation

/// Where a SpoolUp PC serves its deck, and the pairing code when the address came from the
/// QR code the PC shows (`http://192.168.1.20:8765/?t=1a2b3c4d`).
///
/// Only addresses on the home network are accepted: private IPv4 ranges, `.local` names and
/// single-label names. The deck is plain http, which App Transport Security allows for
/// these, and the app never loads anything from the internet as a "PC".
struct PCAddress: Equatable {
    /// The server's default port (`config.port` in server.js).
    static let defaultPort = 8765

    let host: String
    let port: Int
    /// The pairing code from a QR code. Passed to the deck once, as `?t=`, and never saved:
    /// the deck keeps it in its own storage, and a stale code in the address would override a
    /// newer one the player typed.
    var code: String? = nil

    enum Problem: Error, Equatable {
        case empty
        case notHTTP
        case notLocal
        case ipv6
        case badPort
    }

    init(host: String, port: Int, code: String? = nil) {
        self.host = host
        self.port = port
        self.code = code
    }

    /// Reads what the player typed (`192.168.1.20`, `192.168.1.20:8765`, `gaming-pc.local`)
    /// or what a QR code held (a full `http://` address with `?t=`).
    static func parse(_ raw: String) -> Result<PCAddress, Problem> {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty { return .failure(.empty) }
        if text.contains("[") { return .failure(.ipv6) }

        let withScheme = text.contains("://") ? text : "http://" + text
        guard let parts = URLComponents(string: withScheme) else { return .failure(.notLocal) }
        guard parts.scheme?.lowercased() == "http" else { return .failure(.notHTTP) }
        guard var host = parts.host?.lowercased(), !host.isEmpty else { return .failure(.empty) }
        if host.contains(":") { return .failure(.ipv6) }
        if host.hasSuffix(".") { host.removeLast() }
        guard isLocal(host) else { return .failure(.notLocal) }

        let port = parts.port ?? defaultPort
        guard (1024...65535).contains(port) else { return .failure(.badPort) }

        let code = parts.queryItems?.first(where: { $0.name == "t" })?.value.flatMap(validCode)
        return .success(PCAddress(host: host, port: port, code: code))
    }

    /// The deck's address, with the pairing code when there is one.
    func deckURL(code: String? = nil) -> URL? {
        var parts = URLComponents()
        parts.scheme = "http"
        parts.host = host
        parts.port = port
        parts.path = "/"
        if let code = code.flatMap(PCAddress.validCode) {
            parts.queryItems = [URLQueryItem(name: "t", value: code)]
        }
        return parts.url
    }

    /// `192.168.1.20:8765`, as the PC's window shows it.
    var display: String { "\(host):\(port)" }

    /// Pairing codes are what server.js accepts: 1 to 32 letters and digits, lowercase.
    static func validCode(_ raw: String) -> String? {
        let code = raw.lowercased()
        guard (1...32).contains(code.count),
              code.unicodeScalars.allSatisfy({ ("a"..."z").contains($0) || ("0"..."9").contains($0) })
        else { return nil }
        return code
    }

    static func isLocal(_ host: String) -> Bool {
        if host == "localhost" { return false } // that's the phone itself, not the PC
        if let octets = ipv4Octets(host) {
            switch (octets[0], octets[1]) {
            case (10, _): return true
            case (172, 16...31): return true
            case (192, 168): return true
            case (169, 254): return true
            default: return false
            }
        }
        // Something that looks like an IP address but isn't one (999.1.1.1, 1.2.3).
        if host.unicodeScalars.allSatisfy({ ("0"..."9").contains($0) || $0 == "." }) { return false }
        let allowed = host.unicodeScalars.allSatisfy {
            ("a"..."z").contains($0) || ("0"..."9").contains($0) || $0 == "-" || $0 == "."
        }
        guard allowed, !host.hasPrefix("."), !host.contains("..") else { return false }
        return !host.contains(".") || host.hasSuffix(".local")
    }

    static func ipv4Octets(_ host: String) -> [Int]? {
        let pieces = host.split(separator: ".", omittingEmptySubsequences: false)
        guard pieces.count == 4 else { return nil }
        var octets: [Int] = []
        for piece in pieces {
            guard !piece.isEmpty, piece.count <= 3,
                  piece.unicodeScalars.allSatisfy({ ("0"..."9").contains($0) }),
                  let n = Int(piece), n <= 255
            else { return nil }
            octets.append(n)
        }
        return octets
    }
}
