<?php
require_once __DIR__ . '/config.php';

const PSN_AUTH_BASE_URL = 'https://ca.account.sony.com/api/authz/v3/oauth';
const PSN_CLIENT_AUTH = 'Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=';

function psn_http_request(string $url, string $method = 'GET', array $headers = [], ?string $body = null): array {
  $headerLines = [];
  foreach ($headers as $name => $value) {
    $headerLines[] = "{$name}: {$value}";
  }

  $context = stream_context_create([
    'http' => [
      'method' => $method,
      'header' => implode("\r\n", $headerLines),
      'content' => $body ?? '',
      'ignore_errors' => true,
      'follow_location' => 0,
      'timeout' => 20
    ]
  ]);

  $responseBody = file_get_contents($url, false, $context);
  $responseHeaders = $http_response_header ?? [];
  $status = 0;
  if (isset($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $match)) {
    $status = (int)$match[1];
  }

  return [
    'status' => $status,
    'headers' => $responseHeaders,
    'body' => $responseBody === false ? '' : $responseBody
  ];
}

function psn_token_from_refresh(string $refreshToken): ?string {
  $body = http_build_query([
    'refresh_token' => $refreshToken,
    'grant_type' => 'refresh_token',
    'token_format' => 'jwt',
    'scope' => 'psn:mobile.v2.core psn:clientapp'
  ]);

  $response = psn_http_request(PSN_AUTH_BASE_URL . '/token', 'POST', [
    'Content-Type' => 'application/x-www-form-urlencoded',
    'Authorization' => PSN_CLIENT_AUTH
  ], $body);

  $data = json_decode($response['body'], true);
  return is_array($data) && !empty($data['access_token']) ? (string)$data['access_token'] : null;
}

function psn_access_code_from_npsso(string $npsso): ?string {
  $query = http_build_query([
    'access_type' => 'offline',
    'client_id' => '09515159-7237-4370-9b40-3806e67c0891',
    'redirect_uri' => 'com.scee.psxandroid.scecompcall://redirect',
    'response_type' => 'code',
    'scope' => 'psn:mobile.v2.core psn:clientapp'
  ]);

  $response = psn_http_request(PSN_AUTH_BASE_URL . '/authorize?' . $query, 'GET', [
    'Cookie' => 'npsso=' . $npsso
  ]);

  foreach ($response['headers'] as $header) {
    if (stripos($header, 'Location:') !== 0) continue;
    $location = trim(substr($header, 9));
    $parts = parse_url($location);
    if (empty($parts['query'])) continue;
    parse_str($parts['query'], $params);
    if (!empty($params['code'])) return (string)$params['code'];
  }

  return null;
}

function psn_token_from_access_code(string $accessCode): ?string {
  $body = http_build_query([
    'code' => $accessCode,
    'redirect_uri' => 'com.scee.psxandroid.scecompcall://redirect',
    'grant_type' => 'authorization_code',
    'token_format' => 'jwt'
  ]);

  $response = psn_http_request(PSN_AUTH_BASE_URL . '/token', 'POST', [
    'Content-Type' => 'application/x-www-form-urlencoded',
    'Authorization' => PSN_CLIENT_AUTH
  ], $body);

  $data = json_decode($response['body'], true);
  return is_array($data) && !empty($data['access_token']) ? (string)$data['access_token'] : null;
}

function psn_access_token(): string {
  $source = optional_config_value('PSN_REFRESH_TOKEN');
  if ($source === '') {
    throw new RuntimeException('PSN user search is not configured. Add PSN_REFRESH_TOKEN to config.local.php or the hosting environment.');
  }

  $accessToken = psn_token_from_refresh($source);
  if ($accessToken !== null) return $accessToken;

  $accessCode = psn_access_code_from_npsso($source);
  if ($accessCode !== null) {
    $accessToken = psn_token_from_access_code($accessCode);
    if ($accessToken !== null) return $accessToken;
  }

  throw new RuntimeException('Could not authenticate with PSN. Refresh the PSN token configured on the server.');
}

function psn_search_users(string $query): array {
  $accessToken = psn_access_token();
  $response = psn_http_request('https://m.np.playstation.com/api/search/v1/universalSearch', 'POST', [
    'Authorization' => 'Bearer ' . $accessToken,
    'Content-Type' => 'application/json'
  ], json_encode([
    'searchTerm' => $query,
    'domainRequests' => [
      ['domain' => 'SocialAllAccounts']
    ]
  ]));

  $data = json_decode($response['body'], true);
  if (!is_array($data)) {
    throw new RuntimeException('PSN search returned an invalid response.');
  }

  $domainResponses = $data['domainResponses'] ?? $data['data']['domainResponses'] ?? [];
  $accounts = [];
  foreach ($domainResponses as $domain) {
    foreach (($domain['results'] ?? []) as $result) {
      $meta = $result['socialMetadata'] ?? [];
      if (empty($meta['onlineId']) || empty($meta['accountId'])) continue;
      $accounts[] = [
        'onlineId' => (string)$meta['onlineId'],
        'accountId' => (string)$meta['accountId'],
        'avatarUrl' => (string)($meta['avatarUrl'] ?? ''),
        'country' => (string)($meta['country'] ?? ''),
        'language' => (string)($meta['language'] ?? ''),
        'isPsPlus' => (bool)($meta['isPsPlus'] ?? false),
        'isVerified' => (bool)($meta['isOfficiallyVerified'] ?? false),
        'verifiedUserName' => (string)($meta['verifiedUserName'] ?? '')
      ];
    }
  }

  return $accounts;
}
