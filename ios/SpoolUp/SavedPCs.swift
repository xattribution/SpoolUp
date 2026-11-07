import Foundation
import Combine

/// A PC the player has opened before. The pairing code is not kept here: the deck stores it
/// itself, per address, the way it does in Safari.
struct SavedPC: Codable, Identifiable, Equatable {
    var id: UUID
    var name: String
    var host: String
    var port: Int
    /// The Bonjour name the PC advertised, so the app can follow it to a new address.
    var serviceName: String?
    var lastUsed: Date

    var address: PCAddress { PCAddress(host: host, port: port) }
}

/// The saved PCs, kept in UserDefaults on this device only.
final class SavedPCStore: ObservableObject {
    @Published private(set) var pcs: [SavedPC] = []

    private let defaults: UserDefaults
    private let key = "savedPCs"
    /// Enough for a home with a few gaming PCs; the oldest drop off.
    static let limit = 12

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: key),
           let list = try? JSONDecoder().decode([SavedPC].self, from: data) {
            pcs = list.filter { PCAddress.isLocal($0.host) }
        }
    }

    /// Most recent first.
    var sorted: [SavedPC] { pcs.sorted { $0.lastUsed > $1.lastUsed } }
    var lastUsed: SavedPC? { sorted.first }

    /// Saves (or refreshes) a PC and returns it. The same address, or the same Bonjour name,
    /// is the same PC.
    @discardableResult
    func save(_ address: PCAddress, name: String?, serviceName: String?, now: Date = Date()) -> SavedPC {
        let label = name.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.flatMap { $0.isEmpty ? nil : $0 }
        if let i = pcs.firstIndex(where: { ($0.host == address.host && $0.port == address.port)
            || (serviceName != nil && $0.serviceName == serviceName) }) {
            pcs[i].host = address.host
            pcs[i].port = address.port
            if let serviceName = serviceName { pcs[i].serviceName = serviceName }
            if let label = label { pcs[i].name = label }
            pcs[i].lastUsed = now
            write()
            return pcs[i]
        }
        let pc = SavedPC(id: UUID(), name: label ?? address.host, host: address.host, port: address.port,
                         serviceName: serviceName, lastUsed: now)
        pcs.append(pc)
        if pcs.count > SavedPCStore.limit {
            pcs = Array(sorted.prefix(SavedPCStore.limit))
        }
        write()
        return pc
    }

    func markUsed(_ id: UUID, now: Date = Date()) {
        guard let i = pcs.firstIndex(where: { $0.id == id }) else { return }
        pcs[i].lastUsed = now
        write()
    }

    func remove(_ id: UUID) {
        pcs.removeAll { $0.id == id }
        write()
    }

    /// A saved PC was found on the network under its Bonjour name, maybe at a new address
    /// (the router handed out another one). Returns true when the address changed.
    @discardableResult
    func follow(serviceName: String, to address: PCAddress) -> Bool {
        guard let i = pcs.firstIndex(where: { $0.serviceName == serviceName }) else { return false }
        if pcs[i].host == address.host && pcs[i].port == address.port { return false }
        pcs[i].host = address.host
        pcs[i].port = address.port
        write()
        return true
    }

    private func write() {
        if let data = try? JSONEncoder().encode(pcs) { defaults.set(data, forKey: key) }
    }
}
