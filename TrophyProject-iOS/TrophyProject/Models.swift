import Foundation

struct TrophyCounts: Codable, Hashable {
    var platinum: Int = 0
    var gold: Int = 0
    var silver: Int = 0
    var bronze: Int = 0
    var total: Int = 0
}

struct GameSummary: Codable, Identifiable, Hashable {
    var id: String { npwr }
    let npwr: String
    let title: String
    let platform: String
    let platformRaw: String?
    let iconUrl: String
    let counts: TrophyCounts
}

struct GamesResponse: Codable {
    let ok: Bool
    let page: Int
    let perPage: Int
    let total: Int
    let totalPages: Int
    let games: [GameSummary]
}

struct Trophy: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let detail: String
    let type: String
    let hidden: Bool
    let iconUrl: String
}

struct TrophyGroup: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let kind: String
    let detail: String
    let iconUrl: String
    let counts: TrophyCounts
    let trophies: [Trophy]
}

struct GameDetail: Codable, Hashable {
    let npwr: String
    let title: String
    let platform: String
    let iconUrl: String
    let counts: TrophyCounts
    let groups: [TrophyGroup]
}

struct GameDetailResponse: Codable {
    let ok: Bool
    let game: GameDetail?
    let error: String?
}

struct PlannerTitleResponse: Codable {
    let ok: Bool
    let title: PlannerTitle?
    let error: String?
}

struct PlannerTitle: Codable, Identifiable, Hashable {
    var id: String { npwr }
    let npwr: String
    let title: String
    let platform: String
    let iconUrl: String
    let counts: TrophyCounts
    let trophies: [Trophy]
    var selectedIds: [Int] = []

    enum CodingKeys: String, CodingKey {
        case npwr, title, platform, iconUrl, counts, trophies, selectedIds
    }

    init(npwr: String, title: String, platform: String, iconUrl: String, counts: TrophyCounts, trophies: [Trophy], selectedIds: [Int] = []) {
        self.npwr = npwr
        self.title = title
        self.platform = platform
        self.iconUrl = iconUrl
        self.counts = counts
        self.trophies = trophies
        self.selectedIds = selectedIds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        npwr = try container.decode(String.self, forKey: .npwr)
        title = try container.decode(String.self, forKey: .title)
        platform = try container.decode(String.self, forKey: .platform)
        iconUrl = try container.decode(String.self, forKey: .iconUrl)
        counts = try container.decode(TrophyCounts.self, forKey: .counts)
        trophies = try container.decode([Trophy].self, forKey: .trophies)
        selectedIds = try container.decodeIfPresent([Int].self, forKey: .selectedIds) ?? []
    }
}

struct PSNUser: Codable, Hashable {
    let onlineId: String
    let accountId: String
    let avatarUrl: String
    let country: String
    let isPsPlus: Bool
    let isVerified: Bool
}

struct PSNUserSearchResponse: Codable {
    let ok: Bool
    let user: PSNUser?
    let error: String?
}

struct PSNTitle: Codable, Identifiable, Hashable {
    var id: String { npwr }
    let npwr: String
    let service: String
    let title: String
    let platform: String
    let iconUrl: String
    let progress: Int
    let defined: TrophyCounts
    let earned: TrophyCounts
}

struct PSNTitlesResponse: Codable {
    let ok: Bool
    let titles: [PSNTitle]?
    let error: String?
}

struct PSNTrophy: Codable, Identifiable, Hashable {
    let id: Int
    let groupId: String
    let name: String
    let detail: String
    let type: String
    let hidden: Bool
    let iconUrl: String
    let earned: Bool
    let earnedDateTime: String
}

struct PSNTitleGroup: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let detail: String
    let iconUrl: String
    let defined: TrophyCounts
    let earned: TrophyCounts
}

struct PSNTitleDetail: Codable, Hashable {
    let npwr: String
    let service: String
    let progress: Int
    let defined: TrophyCounts
    let earned: TrophyCounts
    let groups: [PSNTitleGroup]
    let trophies: [PSNTrophy]
}

struct PSNTitleDetailResponse: Codable {
    let ok: Bool
    let title: PSNTitleDetail?
    let error: String?
}
