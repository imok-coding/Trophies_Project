import Foundation

@MainActor
final class APIClient: ObservableObject {
    static let shared = APIClient()
    private let base = URL(string: "https://trophyproject.pro")!
    private let decoder = JSONDecoder()

    func games(query: String = "", page: Int = 1) async throws -> GamesResponse {
        try await get("/api/games.php", ["q": query, "page": String(page)])
    }

    func gameDetail(npwr: String) async throws -> GameDetail {
        let response: GameDetailResponse = try await get("/api/game-detail.php", ["npwr": npwr])
        if let game = response.game { return game }
        throw AppError.message(response.error ?? "Game not found.")
    }

    func plannerSearch(query: String) async throws -> [GameSummary] {
        let response: PlannerSearchResponse = try await get("/api/planner-search.php", ["q": query, "limit": "25"])
        return response.results
    }

    func plannerTitle(npwr: String) async throws -> PlannerTitle {
        let response: PlannerTitleResponse = try await get("/api/planner-title.php", ["npwr": npwr])
        if var title = response.title {
            title.selectedIds = title.trophies.map(\.id)
            return title
        }
        throw AppError.message(response.error ?? "Could not load trophy list.")
    }

    func psnUser(onlineId: String) async throws -> PSNUser {
        let response: PSNUserSearchResponse = try await get("/api/psn-user-search.php", ["q": onlineId])
        if let user = response.user { return user }
        throw AppError.message(response.error ?? "User does not exist.")
    }

    func psnTitles(accountId: String) async throws -> [PSNTitle] {
        let response: PSNTitlesResponse = try await get("/api/psn-user-titles.php", ["accountId": accountId, "limit": "800"])
        if let titles = response.titles { return titles }
        throw AppError.message(response.error ?? "Could not load user trophy lists.")
    }

    func psnTitleDetail(accountId: String, npwr: String, service: String) async throws -> PSNTitleDetail {
        let response: PSNTitleDetailResponse = try await get("/api/psn-user-title.php", ["accountId": accountId, "npwr": npwr, "service": service])
        if let title = response.title { return title }
        throw AppError.message(response.error ?? "Could not load trophy list.")
    }

    private func get<T: Decodable>(_ path: String, _ query: [String: String]) async throws -> T {
        var components = URLComponents(url: URL(string: path, relativeTo: base)!.absoluteURL, resolvingAgainstBaseURL: false)!
        components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        let (data, response) = try await URLSession.shared.data(from: components.url!)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw AppError.message("Server returned an error.")
        }
        return try decoder.decode(T.self, from: data)
    }
}

struct PlannerSearchResponse: Codable {
    let ok: Bool
    let results: [GameSummary]
}

enum AppError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self {
        case .message(let value): value
        }
    }
}
