package com.hostel.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class JwtAuth {

    public static final String JWT_SECRET = System.getenv().getOrDefault(
            "JWT_SECRET", "hostelcare_super_secret_jwt_key_2026_hs256_kpriet_lab");

    public record UserPrincipal(long id, String name, String role) {}

    public static UserPrincipal authenticate(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.toLowerCase().startsWith("bearer ")) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Missing bearer token");
            return null;
        }

        String token = authHeader.substring(7).trim();
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid token format");
            return null;
        }

        String headerB64 = parts[0];
        String payloadB64 = parts[1];
        String signatureB64 = parts[2];

        // Verify HMAC-SHA256 signature
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(JWT_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signedBytes = mac.doFinal((headerB64 + "." + payloadB64).getBytes(StandardCharsets.UTF_8));
            String expectedSignature = Base64.getUrlEncoder().withoutPadding().encodeToString(signedBytes);

            if (!expectedSignature.equals(signatureB64)) {
                sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid token signature");
                return null;
            }

            // Parse payload JSON
            byte[] payloadBytes = Base64.getUrlDecoder().decode(payloadB64);
            String payloadJson = new String(payloadBytes, StandardCharsets.UTF_8);

            // Simple parsing to avoid strict reflection dependencies
            long sub = Long.parseLong(extractJsonField(payloadJson, "sub"));
            String name = extractJsonField(payloadJson, "name");
            String role = extractJsonField(payloadJson, "role");
            long exp = Long.parseLong(extractJsonField(payloadJson, "exp"));

            if (System.currentTimeMillis() / 1000L > exp) {
                sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Token expired");
                return null;
            }

            return new UserPrincipal(sub, name, role);

        } catch (Exception e) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Token verification failed: " + e.getMessage());
            return null;
        }
    }

    public static UserPrincipal requireAdmin(HttpServletRequest request, HttpServletResponse response) throws IOException {
        UserPrincipal user = authenticate(request, response);
        if (user == null) {
            return null; // 401 already sent
        }

        if (!"ADMIN".equalsIgnoreCase(user.role())) {
            sendError(response, HttpServletResponse.SC_FORBIDDEN, "Admin access required");
            return null;
        }

        return user;
    }

    private static String extractJsonField(String json, String field) {
        String keyPattern = "\"" + field + "\"\\s*:\\s*";
        int keyIndex = json.indexOf("\"" + field + "\"");
        if (keyIndex == -1) return "";
        int colonIndex = json.indexOf(":", keyIndex);
        if (colonIndex == -1) return "";
        int start = colonIndex + 1;
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) {
            start++;
        }
        if (start >= json.length()) return "";

        if (json.charAt(start) == '"') {
            int end = json.indexOf('"', start + 1);
            return end == -1 ? "" : json.substring(start + 1, end);
        } else {
            int end = start;
            while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '-')) {
                end++;
            }
            return json.substring(start, end);
        }
    }

    public static void sendError(HttpServletResponse response, int statusCode, String message) throws IOException {
        response.setStatus(statusCode);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"" + escapeJson(message) + "\"}");
    }

    public static String escapeJson(String raw) {
        if (raw == null) return "";
        return raw.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}

