import Foundation
import Network

/// A SpoolUp PC heard on the network over Bonjour.
struct FoundPC: Identifiable, Equatable {
    /// The Bonjour service name: the PC's name, as the server advertises it.
    let serviceName: String
    /// Filled in once the service resolves to an IPv4 address on the home network.
    var address: PCAddress?

    var id: String { serviceName }
}

/// Finds SpoolUp PCs with Bonjour (`_spoolup._tcp`, advertised by the server on the PC).
///
/// Browsing is what makes iOS ask for Local Network access the first time. Nothing is sent
/// to a PC here except a TCP connect to learn its address, which is closed at once.
@MainActor
final class Discovery: ObservableObject {
    static let serviceType = "_spoolup._tcp"

    enum Status: Equatable {
        case idle
        case searching
        /// The player said no to Local Network access (Settings > SpoolUp turns it back on).
        case denied
        case failed
    }

    @Published private(set) var found: [FoundPC] = []
    @Published private(set) var status: Status = .idle

    /// Called when a PC resolves, so saved PCs can follow it to a new address.
    var onResolved: ((FoundPC) -> Void)?

    private var browser: NWBrowser?
    private var resolving: [String: NWConnection] = [:]

    func start() {
        guard browser == nil else { return }
        let params = NWParameters()
        params.includePeerToPeer = false
        let browser = NWBrowser(for: .bonjour(type: Discovery.serviceType, domain: nil), using: params)
        browser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in self?.browserChanged(state) }
        }
        browser.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in self?.resultsChanged(results) }
        }
        self.browser = browser
        status = .searching
        browser.start(queue: .main)
    }

    func stop() {
        browser?.cancel()
        browser = nil
        for connection in resolving.values { connection.cancel() }
        resolving = [:]
        status = .idle
    }

    private func browserChanged(_ state: NWBrowser.State) {
        switch state {
        case .ready:
            status = .searching
        case .waiting(let error), .failed(let error):
            // kDNSServiceErr_PolicyDenied: Local Network access is off for this app.
            if case .dns(let code) = error, code == -65570 {
                status = .denied
            } else if case .failed = state {
                status = .failed
                // Try again from scratch, as Apple's samples do after a failure.
                browser?.cancel()
                browser = nil
                Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    self?.start()
                }
            }
        default:
            break
        }
    }

    private func resultsChanged(_ results: Set<NWBrowser.Result>) {
        var next: [FoundPC] = []
        for result in results {
            guard case .service(let name, _, _, _) = result.endpoint else { continue }
            let known = found.first { $0.serviceName == name }
            next.append(FoundPC(serviceName: name, address: known?.address))
            if known?.address == nil && resolving[name] == nil { resolve(result.endpoint, name: name) }
        }
        for (name, connection) in resolving where !next.contains(where: { $0.serviceName == name }) {
            connection.cancel()
            resolving[name] = nil
        }
        found = next.sorted { $0.serviceName.localizedCaseInsensitiveCompare($1.serviceName) == .orderedAscending }
        if status == .denied { status = .searching }
    }

    /// Learns a service's IPv4 address and port by connecting to it, then hangs up. The deck
    /// is opened by IP address, the same way the PC's QR code does it.
    private func resolve(_ endpoint: NWEndpoint, name: String) {
        let params = NWParameters.tcp
        if let ip = params.defaultProtocolStack.internetProtocol as? NWProtocolIP.Options {
            ip.version = .v4
        }
        let connection = NWConnection(to: endpoint, using: params)
        resolving[name] = connection
        connection.stateUpdateHandler = { [weak self, weak connection] state in
            guard let connection = connection else { return }
            switch state {
            case .ready:
                let address = Discovery.address(of: connection.currentPath?.remoteEndpoint)
                connection.cancel()
                Task { @MainActor in self?.resolved(name, address) }
            case .failed, .waiting:
                connection.cancel()
                Task { @MainActor in self?.resolved(name, nil) }
            default:
                break
            }
        }
        connection.start(queue: .main)
        Task { @MainActor [weak self, weak connection] in
            try? await Task.sleep(nanoseconds: 6_000_000_000)
            guard let self = self, let connection = connection, self.resolving[name] === connection else { return }
            connection.cancel()
            self.resolving[name] = nil
        }
    }

    private func resolved(_ name: String, _ address: PCAddress?) {
        resolving[name] = nil
        guard let address = address, let i = found.firstIndex(where: { $0.serviceName == name }) else { return }
        found[i].address = address
        onResolved?(found[i])
    }

    nonisolated static func address(of endpoint: NWEndpoint?) -> PCAddress? {
        guard case .hostPort(let host, let port)? = endpoint, case .ipv4(let ip) = host else { return nil }
        let text = ip.rawValue.map { String($0) }.joined(separator: ".")
        guard PCAddress.isLocal(text) else { return nil }
        let number = Int(port.rawValue)
        guard (1024...65535).contains(number) else { return nil }
        return PCAddress(host: text, port: number)
    }
}
