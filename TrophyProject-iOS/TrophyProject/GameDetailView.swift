import SwiftUI

struct GameDetailView: View {
    let npwr: String
    @State private var game: GameDetail?
    @State private var error: String?

    var body: some View {
        ScrollView {
            if let game {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 14) {
                        RemoteIcon(url: game.iconUrl, size: 86)
                        VStack(alignment: .leading, spacing: 7) {
                            Text(game.title).font(.title2.bold())
                            Text(game.npwr).font(.caption.monospaced()).foregroundStyle(.secondary)
                            Text(game.platform).font(.caption).foregroundStyle(.secondary)
                            TrophyCountsView(counts: game.counts)
                        }
                    }
                    .padding()
                    .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 20))

                    ForEach(Array(game.groups.enumerated()), id: \.element.id) { index, group in
                        TrophyGroupView(group: group, dlcIndex: group.kind == "dlc" ? index : nil)
                    }
                }
                .padding()
            } else if let error {
                Text(error).foregroundStyle(.red).padding()
            } else {
                ProgressView().padding()
            }
        }
        .navigationTitle("Trophies")
        .navigationBarTitleDisplayMode(.inline)
        .appBackground()
        .task { await load() }
    }

    private func load() async {
        do { game = try await APIClient.shared.gameDetail(npwr: npwr) }
        catch { self.error = error.localizedDescription }
    }
}

struct TrophyGroupView: View {
    let group: TrophyGroup
    let dlcIndex: Int?

    var body: some View {
        VStack(spacing: 0) {
            if group.kind == "dlc" {
                Text("DLC Trophy Pack \(max(1, dlcIndex ?? 1))")
                    .font(.caption.bold())
                    .textCase(.uppercase)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Color(red: 0.21, green: 0.41, blue: 0.62))
            }
            HStack(spacing: 12) {
                RemoteIcon(url: group.iconUrl, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(group.kind == "base" ? "Base Game" : "DLC")
                        .font(.caption2.bold())
                        .foregroundStyle(group.kind == "base" ? .cyan : .purple)
                    Text(group.name).font(.headline)
                    Text("\(group.counts.total.formatted()) trophies").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                TrophyCountsView(counts: group.counts)
            }
            .padding(12)
            .background(.white.opacity(0.045))

            ForEach(group.trophies) { trophy in
                TrophyRow(trophy: trophy)
                Divider().opacity(0.35)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.09)))
    }
}

struct TrophyRow: View {
    let trophy: Trophy
    var body: some View {
        HStack(spacing: 12) {
            RemoteIcon(url: trophy.iconUrl, size: 50)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(trophy.name.isEmpty ? "Hidden Trophy" : trophy.name)
                        .font(.subheadline.bold())
                    if trophy.hidden {
                        Text("Secret")
                            .font(.caption2.bold())
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 5))
                    }
                }
                Text(trophy.detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            trophySymbol(trophy.type)
        }
        .padding(12)
    }

    private func trophySymbol(_ type: String) -> some View {
        let color: Color
        switch type {
        case "platinum":
            color = .cyan
        case "gold":
            color = .yellow
        case "silver":
            color = .gray
        default:
            color = .orange
        }
        return Image(systemName: type == "platinum" ? "rosette" : "trophy.fill")
            .foregroundStyle(color)
            .font(.title3)
    }
}
