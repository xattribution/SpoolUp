import SwiftUI
import UIKit

/// The list of PCs: the ones Bonjour hears on this network, the ones opened before, and the
/// other ways in (scan the PC's QR code, type its address, or try the demo).
struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var saved: SavedPCStore
    @EnvironmentObject private var discovery: Discovery

    @State private var sheet: Sheet?

    enum Sheet: String, Identifiable {
        case scan, type, about
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            List {
                if let notice = model.notice {
                    Section {
                        Label(notice, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Palette.text)
                            .listRowBackground(Palette.raised)
                    }
                }
                foundSection
                if !saved.pcs.isEmpty { savedSection }
                Section {
                    Button { sheet = .scan } label: {
                        Label("Scan the QR code on your PC", systemImage: "qrcode.viewfinder")
                    }
                    Button { sheet = .type } label: {
                        Label("Type the address", systemImage: "keyboard")
                    }
                    Button { model.openDemo() } label: {
                        Label("Try the demo", systemImage: "play.rectangle")
                    }
                } footer: {
                    Text("The demo runs without a PC. Presses only light up the buttons.")
                }
                .listRowBackground(Palette.panel)
            }
            .scrollContentBackground(.hidden)
            .background(Palette.background)
            .navigationTitle("SpoolUp")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { sheet = .about } label: { Image(systemName: "info.circle") }
                        .accessibilityLabel(Text("About SpoolUp"))
                }
            }
        }
        .onAppear {
            discovery.start()
            model.openLastOnLaunch()
        }
        .onDisappear { discovery.stop() }
        .sheet(item: $sheet) { which in
            switch which {
            case .scan: ScanSheet { address in sheet = nil; model.open(address, name: nil) }
            case .type: AddressSheet { address, name in sheet = nil; model.open(address, name: name) }
            case .about: AboutSheet()
            }
        }
    }

    private var foundSection: some View {
        Section {
            ForEach(discovery.found) { pc in
                Button { model.open(pc) } label: {
                    PCRow(name: pc.serviceName, detail: pc.address?.display ?? NSLocalizedString("Finding its address…", comment: ""))
                }
                .disabled(pc.address == nil)
            }
            if discovery.found.isEmpty {
                switch discovery.status {
                case .denied:
                    VStack(alignment: .leading, spacing: 8) {
                        Text("SpoolUp can't look for PCs: Local Network is off for it.")
                            .foregroundStyle(Palette.text)
                        Button("Open Settings") { openSettings() }
                    }
                case .failed:
                    Text("Looking for PCs didn't work. Scan the QR code or type the address instead.")
                        .foregroundStyle(Palette.dim)
                default:
                    HStack(spacing: 12) {
                        ProgressView()
                        Text("Looking for SpoolUp on your PC…").foregroundStyle(Palette.dim)
                    }
                }
            }
        } header: {
            Text("On this network")
        } footer: {
            Text("Start SpoolUp on your gaming PC. It shows up here when the iPad or iPhone is on the same Wi-Fi.")
        }
        .listRowBackground(Palette.panel)
    }

    private var savedSection: some View {
        Section {
            ForEach(saved.sorted) { pc in
                Button { model.open(pc) } label: { PCRow(name: pc.name, detail: pc.address.display) }
                    .swipeActions {
                        Button(role: .destructive) { saved.remove(pc.id) } label: { Text("Forget") }
                    }
            }
        } header: {
            Text("Saved PCs")
        }
        .listRowBackground(Palette.panel)
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }
}

struct PCRow: View {
    let name: String
    let detail: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "desktopcomputer").foregroundStyle(Palette.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).foregroundStyle(Palette.text)
                Text(detail).font(.footnote.monospacedDigit()).foregroundStyle(Palette.dim)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.footnote).foregroundStyle(Palette.dim)
        }
        .contentShape(Rectangle())
    }
}

/// Typing the address the PC's window shows, like 192.168.1.20:8765.
struct AddressSheet: View {
    let onOpen: (PCAddress, String?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var address = ""
    @State private var name = ""
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("192.168.1.20:8765", text: $address)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .onSubmit(open)
                    TextField("Name (optional)", text: $name)
                } footer: {
                    Text(problem ?? NSLocalizedString("The SpoolUp window on your PC shows its address. The deck asks for the pairing code next.", comment: ""))
                        .foregroundStyle(problem == nil ? Palette.dim : Palette.warn)
                }
                .listRowBackground(Palette.panel)
            }
            .scrollContentBackground(.hidden)
            .background(Palette.background)
            .navigationTitle("Type the address")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Connect", action: open) }
            }
        }
    }

    private func open() {
        switch PCAddress.parse(address) {
        case .success(let parsed): onOpen(parsed, name)
        case .failure(let why): problem = AppModel.message(for: why)
        }
    }
}

/// Scanning the QR code in the PC's SpoolUp window, which holds the address and pairing code.
struct ScanSheet: View {
    let onOpen: (PCAddress) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var allowed: Bool?
    @State private var problem: String?
    @State private var attempt = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Palette.background.ignoresSafeArea()
                switch allowed {
                case .some(true):
                    QRScannerView(onCode: read)
                        .id(attempt)
                        .ignoresSafeArea(edges: .bottom)
                    VStack {
                        Spacer()
                        Text(problem ?? NSLocalizedString("Point the camera at the QR code in the SpoolUp window on your PC.", comment: ""))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(problem == nil ? Palette.text : Palette.warn)
                            .padding(16)
                            .background(Palette.panel.opacity(0.92), in: RoundedRectangle(cornerRadius: 12))
                            .padding(16)
                        if problem != nil {
                            Button("Scan again") { problem = nil; attempt += 1 }
                                .buttonStyle(.borderedProminent)
                                .padding(.bottom, 24)
                        }
                    }
                case .some(false):
                    VStack(spacing: 16) {
                        Text("SpoolUp needs the camera to scan the QR code. You can turn it on in Settings, or type the address instead.")
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Palette.text)
                        Button("Open Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(24)
                case .none:
                    ProgressView()
                }
            }
            .navigationTitle("Scan the QR code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .onAppear { CameraAccess.request { allowed = $0 } }
    }

    private func read(_ text: String) {
        switch PCAddress.parse(text) {
        case .success(let address) where text.lowercased().hasPrefix("http://"):
            onOpen(address)
        default:
            problem = NSLocalizedString("That QR code isn't a SpoolUp address. Use the one in the SpoolUp window on your PC.", comment: "")
        }
    }
}

/// What SpoolUp is, what it keeps, and the fan disclaimer.
struct AboutSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("SpoolUp turns this iPad or iPhone into a control deck for your gaming PC. Each tap sends one key press to the SpoolUp app on the PC, over your home network.")
                    Text("Needs the free SpoolUp app for Windows on your PC. The demo works without it.")
                }
                .listRowBackground(Palette.panel)
                Section {
                    Text("SpoolUp collects nothing. The PCs you save stay on this device. The deck talks only to your PC, and loads its fonts from Google Fonts.")
                } header: {
                    Text("Privacy")
                }
                .listRowBackground(Palette.panel)
                Section {
                    Text("SpoolUp is an unofficial fan project. It isn't made by, affiliated with or endorsed by the maker of any game.")
                }
                .listRowBackground(Palette.panel)
                Section {
                    Text(verbatim: "SpoolUp \(Bundle.main.shortVersion)")
                        .foregroundStyle(Palette.dim)
                }
                .listRowBackground(Palette.panel)
            }
            .foregroundStyle(Palette.text)
            .scrollContentBackground(.hidden)
            .background(Palette.background)
            .navigationTitle("About SpoolUp")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
