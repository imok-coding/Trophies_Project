import SwiftUI

struct PSNUserView: View {
    @State private var query = ""
    @State private var user: PSNUser?
    @State private var titles: [PSNTitle] = []
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        SearchField(placeholder: "Exact PSN online ID", text: $query)
                        Button("Search") { Task { await lookup() } }
                            .font(.headline)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(.cyan, in: RoundedRectangle(cornerRadius: 14))
                            .foregroundStyle(.black)
                    }

                    if isLoading { ProgressView().frame(maxWidth: .infinity) }
                    if let error { Text(error).foregroundStyle(.red) }
                    if let user {
                        profile(user)
                    }
                    ForEach(titles) { title in
                        NavigationLink { PSNTitleDetailView(user: user, title: title) } label: {
                            HStack {
                                RemoteIcon(url: title.iconUrl)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(title.title).font(.headline).lineLimit(1)
                                    Text("\(title.npwr) - \(title.platform) - \(title.progress)%").font(.caption).foregroundStyle(.secondary)
                                    TrophyCountsView(counts: title.earned)
                                }
                                Spacer()
                            }
                            .padding(12)
                            .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("PSN Users")
            .appBackground()
        }
    }

    private func profile(_ user: PSNUser) -> some View {
        HStack(spacing: 14) {
            RemoteIcon(url: user.avatarUrl, size: 72)
            VStack(alignment: .leading, spacing: 4) {
                Text(user.onlineId).font(.title2.bold())
                Text(user.accountId).font(.caption.monospaced()).foregroundStyle(.secondary)
                if !user.country.isEmpty { Text(user.country).font(.caption.bold()).foregroundStyle(.cyan) }
            }
            Spacer()
            Text("\(titles.count.formatted()) lists").font(.caption.bold()).foregroundStyle(.secondary)
        }
        .padding()
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 20))
    }

    private func lookup() async {
        isLoading = true
        error = nil
        titles = []
        do {
            let found = try await APIClient.shared.psnUser(onlineId: query)
            user = found
            titles = try await APIClient.shared.psnTitles(accountId: found.accountId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct PSNTitleDetailView: View {
    let user: PSNUser?
    let title: PSNTitle
    @State private var detail: PSNTitleDetail?
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 14) {
                    RemoteIcon(url: title.iconUrl, size: 86)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(title.title).font(.title2.bold())
                        Text(title.npwr).font(.caption.monospaced()).foregroundStyle(.secondary)
                        Text("\(title.progress)% complete").font(.headline).foregroundStyle(.cyan)
                        TrophyCountsView(counts: title.earned)
                    }
                }
                .padding()
                .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 20))

                if let detail {
                    ForEach(Array(detail.groups.enumerated()), id: \.element.id) { index, group in
                        PSNTitleGroupView(group: group, trophies: detail.trophies.filter { $0.groupId == group.id }, dlcIndex: group.id == "default" ? nil : index)
                    }
                } else if let error {
                    Text(error).foregroundStyle(.red)
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .padding()
        }
        .navigationTitle("Trophy List")
        .navigationBarTitleDisplayMode(.inline)
        .appBackground()
        .task { await load() }
    }

    private func load() async {
        guard let user else { return }
        do { detail = try await APIClient.shared.psnTitleDetail(accountId: user.accountId, npwr: title.npwr, service: title.service) }
        catch { self.error = error.localizedDescription }
    }
}

struct PSNTitleGroupView: View {
    let group: PSNTitleGroup
    let trophies: [PSNTrophy]
    let dlcIndex: Int?

    var body: some View {
        VStack(spacing: 0) {
            if group.id != "default" {
                Text("DLC Trophy Pack \(max(1, dlcIndex ?? 1))")
                    .font(.caption.bold())
                    .textCase(.uppercase)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Color(red: 0.21, green: 0.41, blue: 0.62))
            }
            HStack(spacing: 12) {
                RemoteIcon(url: group.iconUrl, size: 54)
                VStack(alignment: .leading) {
                    Text(group.id == "default" ? "Base Game" : "DLC").font(.caption2.bold()).foregroundStyle(group.id == "default" ? .cyan : .purple)
                    Text(group.name).font(.headline)
                    Text("\(group.earned.total)/\(group.defined.total) earned").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                TrophyCountsView(counts: group.earned)
            }
            .padding(12)
            .background(.white.opacity(0.045))

            ForEach(trophies) { trophy in
                PSNTrophyRow(trophy: trophy)
                Divider().opacity(0.35)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.09)))
    }
}

struct PSNTrophyRow: View {
    let trophy: PSNTrophy
    var body: some View {
        HStack(spacing: 12) {
            RemoteIcon(url: trophy.iconUrl, size: 50)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(trophy.name.isEmpty ? "Hidden Trophy" : trophy.name).font(.subheadline.bold())
                    if trophy.hidden {
                        Text("Secret").font(.caption2.bold()).padding(.horizontal, 5).padding(.vertical, 2).background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 5))
                    }
                }
                Text(trophy.detail).font(.caption).foregroundStyle(.secondary)
                if trophy.earned && trophy.earnedDateTime.isEmpty == false {
                    Text("Earned \(trophy.earnedDateTime.prefix(10))").font(.caption2).foregroundStyle(.green)
                }
            }
            Spacer()
            Image(systemName: trophy.earned ? "checkmark" : "minus").foregroundStyle(trophy.earned ? .green : .secondary)
        }
        .padding(12)
    }
}
