package com.hostel.servlet;

import com.hostel.config.Db;
import com.hostel.security.JwtAuth;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.BufferedReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Set;

@WebServlet(name = "StatusServlet", urlPatterns = {"/api/maintenance/status"})
public class StatusServlet extends HttpServlet {

    private static final Set<String> VALID_STATUSES = Set.of(
            "SUBMITTED", "IN_PROGRESS", "RESOLVED", "REJECTED"
    );

    @Override
    protected void doOptions(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);
        resp.setStatus(HttpServletResponse.SC_OK);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);

        // Verify JWT token and ADMIN role (Chapter 4.2 & 4.4)
        JwtAuth.UserPrincipal admin = JwtAuth.requireAdmin(req, resp);
        if (admin == null) {
            return; // 401 or 403 sent
        }

        // Parse JSON request body
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = req.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        }
        String body = sb.toString();

        long issueId = 0;
        String newStatus = "";
        String remarks = "Updated by hostel administrator";

        try {
            issueId = parseLongField(body, "issue_id");
            newStatus = parseStringField(body, "status").trim().toUpperCase();
            String userRemarks = parseStringField(body, "remarks");
            if (!userRemarks.isEmpty()) {
                remarks = userRemarks;
            }
        } catch (Exception e) {
            JwtAuth.sendError(resp, 422, "Invalid request payload");
            return;
        }

        if (issueId <= 0 || !VALID_STATUSES.contains(newStatus)) {
            JwtAuth.sendError(resp, 422, "Invalid issue id or status");
            return;
        }

        // Execute Transaction (Chapter 4.4)
        Connection conn = null;
        try {
            conn = Db.getConnection();
            conn.setAutoCommit(false); // Begin JDBC transaction

            // 1. Read old status and lock row FOR UPDATE
            String selectSql = "SELECT status FROM maintenance_issues WHERE id = ? FOR UPDATE";
            String oldStatus = null;
            try (PreparedStatement stmt = conn.prepareStatement(selectSql)) {
                stmt.setLong(1, issueId);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        oldStatus = rs.getString("status");
                    }
                }
            }

            if (oldStatus == null) {
                conn.rollback();
                JwtAuth.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Issue not found");
                return;
            }

            // 2. Change the status and update timestamp
            String updateSql = "UPDATE maintenance_issues SET status = ?, updated_at = NOW() WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
                stmt.setString(1, newStatus);
                stmt.setLong(2, issueId);
                stmt.executeUpdate();
            }

            // 3. Record the change in audit_logs
            String insertSql = "INSERT INTO audit_logs (issue_id, actor_user_id, old_status, new_status, remarks, created_at) " +
                    "VALUES (?, ?, ?, ?, ?, NOW())";
            try (PreparedStatement stmt = conn.prepareStatement(insertSql)) {
                stmt.setLong(1, issueId);
                stmt.setLong(2, admin.id());
                stmt.setString(3, oldStatus);
                stmt.setString(4, newStatus);
                stmt.setString(5, remarks);
                stmt.executeUpdate();
            }

            // 4. Commit transaction
            conn.commit();

            resp.setStatus(HttpServletResponse.SC_OK);
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.getWriter().write(String.format(
                    "{\"message\":\"Status updated successfully\",\"issue_id\":%d,\"old_status\":\"%s\",\"new_status\":\"%s\"}",
                    issueId, JwtAuth.escapeJson(oldStatus), JwtAuth.escapeJson(newStatus)
            ));

        } catch (SQLException e) {
            if (conn != null) {
                try {
                    conn.rollback();
                } catch (SQLException ignored) {}
            }
            JwtAuth.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Transaction error: " + e.getMessage());
        } finally {
            if (conn != null) {
                try {
                    conn.setAutoCommit(true);
                    conn.close();
                } catch (SQLException ignored) {}
            }
        }
    }

    private void setCorsHeaders(HttpServletResponse resp) {
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    private long parseLongField(String json, String field) {
        int idx = json.indexOf("\"" + field + "\"");
        if (idx == -1) return 0;
        int colon = json.indexOf(":", idx);
        if (colon == -1) return 0;
        int start = colon + 1;
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) start++;
        int end = start;
        while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '-')) end++;
        return Long.parseLong(json.substring(start, end));
    }

    private String parseStringField(String json, String field) {
        int idx = json.indexOf("\"" + field + "\"");
        if (idx == -1) return "";
        int colon = json.indexOf(":", idx);
        if (colon == -1) return "";
        int start = json.indexOf("\"", colon + 1);
        if (start == -1) return "";
        int end = json.indexOf("\"", start + 1);
        if (end == -1) return "";
        return json.substring(start + 1, end);
    }
}

