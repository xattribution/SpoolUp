import Foundation
import SwiftUI

/// The house colors from docs/DESIGN.md (the RSI look the editor and website use).
enum Palette {
    static let background = Color(red: 0x05 / 255, green: 0x09 / 255, blue: 0x0f / 255)
    static let panel = Color(red: 0x0b / 255, green: 0x17 / 255, blue: 0x26 / 255)
    static let raised = Color(red: 0x12 / 255, green: 0x25 / 255, blue: 0x3b / 255)
    static let line = Color(red: 0x1f / 255, green: 0x3a / 255, blue: 0x58 / 255)
    static let accent = Color(red: 0x4f / 255, green: 0xb3 / 255, blue: 0xff / 255)
    static let text = Color(red: 0xe8 / 255, green: 0xee / 255, blue: 0xf5 / 255)
    static let dim = Color(red: 0x8a / 255, green: 0xa0 / 255, blue: 0xb8 / 255)
    static let warn = Color(red: 0xff / 255, green: 0xb0 / 255, blue: 0x20 / 255)
}

/// Which screen is up, and the moves between them.
@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var deck: DeckTarget?
    /// Why the last deck closed, shown on the list of PCs until the next try.
    @Published var notice: String?

    let saved: SavedPCStore
    let discovery: Discovery
    private var autoOpened = false

    init(saved: SavedPCStore = SavedPCStore(), discovery: Discovery = Discovery()) {
        self.saved = saved
        self.discovery = discovery
        discovery.onResolved = { [weak saved] pc in
            guard let address = pc.address else { return }
            saved?.follow(serviceName: pc.serviceName, to: address)
        }
    }

    /// The first time the app starts up, it goes straight to the PC used last, as the
    /// Android app does. Switch PC (or a PC that doesn't answer) brings the list back.
    func openLastOnLaunch() {
        guard !autoOpened else { return }
        autoOpened = true
        if let pc = saved.lastUsed { open(pc) }
    }

    func open(_ pc: SavedPC) {
        guard let url = pc.address.deckURL() else { return }
        saved.markUsed(pc.id)
        show(DeckTarget(url: url, title: pc.name))
    }

    func open(_ found: FoundPC) {
        guard let address = found.address else { return }
        let pc = saved.save(address, name: found.serviceName, serviceName: found.serviceName)
        open(pc)
    }

    /// A typed address or a scanned QR code. The QR code's pairing code goes to the deck once.
    func open(_ address: PCAddress, name: String?) {
        let pc = saved.save(address, name: name, serviceName: nil)
        guard let url = pc.address.deckURL(code: address.code) else { return }
        show(DeckTarget(url: url, title: pc.name))
    }

    func openDemo() {
        show(DeckTarget(url: DemoScheme.startURL, title: NSLocalizedString("Demo", comment: "")))
    }

    func leaveDeck(_ reason: String?) {
        notice = reason
        deck = nil
    }

    private func show(_ target: DeckTarget) {
        notice = nil
        deck = target
    }

    static func message(for problem: PCAddress.Problem) -> String {
        switch problem {
        case .empty:
            return NSLocalizedString("Type the address the SpoolUp window shows on your PC.", comment: "")
        case .notHTTP:
            return NSLocalizedString("That isn't a SpoolUp address. It starts with http://", comment: "")
        case .notLocal:
            return NSLocalizedString("SpoolUp only connects to PCs on your home network, like 192.168.1.20.", comment: "")
        case .ipv6:
            return NSLocalizedString("Use the PC's IPv4 address, like 192.168.1.20.", comment: "")
        case .badPort:
            return NSLocalizedString("The port must be a number from 1024 to 65535.", comment: "")
        }
    }
}
