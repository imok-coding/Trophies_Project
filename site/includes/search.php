<?php

function normalize_search_term(string $value): string {
  $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $value = preg_replace('/[^\p{L}\p{N}]+/u', '', $value) ?? '';
  return strtolower($value);
}

function normalized_title_sql(string $column): string {
  $expr = "LOWER($column)";
  $replacements = [
    "' '", "''''", "'`'", "'.'", "','", "':'", "';'", "'-'", "'_'", "'!'", "'?'",
    "'('", "')'", "'['", "']'", "'{'", "'}'", "'/'", "'&'", "'+'", "'\"'",
    "CONVERT(UNHEX('E28099') USING utf8mb4) COLLATE utf8mb4_unicode_ci",
    "CONVERT(UNHEX('E284A2') USING utf8mb4) COLLATE utf8mb4_unicode_ci",
    "CONVERT(UNHEX('C2AE') USING utf8mb4) COLLATE utf8mb4_unicode_ci",
    "CONVERT(UNHEX('C2A9') USING utf8mb4) COLLATE utf8mb4_unicode_ci"
  ];

  foreach ($replacements as $literal) {
    $expr = "REPLACE($expr, $literal, '')";
  }

  return $expr;
}
