import XCTest
@testable import SpoolUp

final class PCAddressTests: XCTestCase {
    private func parse(_ text: String) -> PCAddress? {
        if case .success(let address) = PCAddress.parse(text) { return address }
        return nil
    }

    private func problem(_ text: String) -> PCAddress.Problem? {
        if case .failure(let why) = PCAddress.parse(text) { return why }
        return nil
    }

    func testTypedAddresses() {
        XCTAssertEqual(parse("192.168.1.20"), PCAddress(host: "192.168.1.20", port: 8765))
        XCTAssertEqual(parse(" 192.168.1.20:8790 "), PCAddress(host: "192.168.1.20", port: 8790))
        XCTAssertEqual(parse("10.0.0.5"), PCAddress(host: "10.0.0.5", port: 8765))
        XCTAssertEqual(parse("172.20.1.2:9000"), PCAddress(host: "172.20.1.2", port: 9000))
        XCTAssertEqual(parse("Gaming-PC.local"), PCAddress(host: "gaming-pc.local", port: 8765))
        XCTAssertEqual(parse("gaming-pc"), PCAddress(host: "gaming-pc", port: 8765))
    }

    func testQRCodeAddress() {
        let address = parse("http://192.168.1.20:8765/?t=1a2b3c4d")
        XCTAssertEqual(address?.host, "192.168.1.20")
        XCTAssertEqual(address?.port, 8765)
        XCTAssertEqual(address?.code, "1a2b3c4d")
        XCTAssertEqual(address?.deckURL(code: address?.code)?.absoluteString, "http://192.168.1.20:8765/?t=1a2b3c4d")
        XCTAssertEqual(address?.deckURL()?.absoluteString, "http://192.168.1.20:8765/")
    }

    func testBadPairingCodeIsDropped() {
        XCTAssertNil(parse("http://192.168.1.20:8765/?t=ab_12")?.code)
        XCTAssertEqual(parse("http://192.168.1.20:8765/?t=1A2B3C4D")?.code, "1a2b3c4d")
        XCTAssertNil(parse("http://192.168.1.20:8765/?t=")?.code)
    }

    func testOnlyHomeNetwork() {
        XCTAssertEqual(problem(""), .empty)
        XCTAssertEqual(problem("8.8.8.8"), .notLocal)
        XCTAssertEqual(problem("172.32.0.1"), .notLocal)
        XCTAssertEqual(problem("example.com"), .notLocal)
        XCTAssertEqual(problem("localhost"), .notLocal)
        XCTAssertEqual(problem("127.0.0.1"), .notLocal)
        XCTAssertEqual(problem("999.168.1.1"), .notLocal)
        XCTAssertEqual(problem("https://192.168.1.20"), .notHTTP)
        XCTAssertEqual(problem("ftp://192.168.1.20"), .notHTTP)
        XCTAssertNotNil(problem("javascript:alert(1)"))
        XCTAssertEqual(problem("[fe80::1]:8765"), .ipv6)
        XCTAssertEqual(problem("192.168.1.20:80"), .badPort)
        XCTAssertNotNil(problem("192.168.1.20:70000"))
    }
}

final class SavedPCStoreTests: XCTestCase {
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "SavedPCStoreTests")
        defaults.removePersistentDomain(forName: "SavedPCStoreTests")
    }

    func testSaveDedupesAndPersists() {
        let store = SavedPCStore(defaults: defaults)
        let a = store.save(PCAddress(host: "192.168.1.20", port: 8765), name: "Desk", serviceName: nil)
        let b = store.save(PCAddress(host: "192.168.1.20", port: 8765), name: nil, serviceName: nil)
        XCTAssertEqual(a.id, b.id)
        XCTAssertEqual(store.pcs.count, 1)
        XCTAssertEqual(SavedPCStore(defaults: defaults).pcs.first?.name, "Desk")
    }

    func testFollowsBonjourNameToNewAddress() {
        let store = SavedPCStore(defaults: defaults)
        store.save(PCAddress(host: "192.168.1.20", port: 8765), name: "Desk", serviceName: "Desk")
        XCTAssertTrue(store.follow(serviceName: "Desk", to: PCAddress(host: "192.168.1.31", port: 8765)))
        XCTAssertEqual(store.pcs.first?.host, "192.168.1.31")
        XCTAssertFalse(store.follow(serviceName: "Other", to: PCAddress(host: "192.168.1.40", port: 8765)))
    }

    func testLastUsedAndLimit() {
        let store = SavedPCStore(defaults: defaults)
        for i in 0..<(SavedPCStore.limit + 3) {
            store.save(PCAddress(host: "192.168.1.\(i + 2)", port: 8765), name: nil, serviceName: nil,
                       now: Date(timeIntervalSince1970: TimeInterval(i)))
        }
        XCTAssertEqual(store.pcs.count, SavedPCStore.limit)
        XCTAssertEqual(store.lastUsed?.host, "192.168.1.\(SavedPCStore.limit + 4)")
    }
}

final class BridgeTests: XCTestCase {
    func testMessages() {
        XCTAssertEqual(Bridge.read(["haptic": "tap"]), .haptic("tap"))
        XCTAssertEqual(Bridge.read(["switchPC": true]), .switchPC)
        XCTAssertNil(Bridge.read(["switchPC": false]))
        XCTAssertNil(Bridge.read("tap"))
        XCTAssertNil(Bridge.read(["haptic": String(repeating: "x", count: 100)]))
    }
}
