package com.hostel.servlet;

import com.hostel.config.Db;
import com.hostel.security.JwtAuth;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@WebServlet(name = "AuditServlet", urlPatterns = {"/api/maintenance/audit"})
public class AuditServlet extends HttpServlet {

    @Override
    protected void doOptions(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);
        resp.setStatus(HttpServletResponse.SC_OK);
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);

        // Verify ADMIN role (Chapter 4.2 & 4.5, Table 6.1 Test Case 10)
        JwtAuth.UserPrincipal admin = JwtAuth.requireAdmin(req, resp);
        if (admin == null) {
            return; // 401 or 403 sent
        }

        String issueIdParam = req.getParameter("issue_id");
        if (issueIdParam == null || issueIdParam.trim().isEmpty()) {
            JwtAuth.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "issue_id is required");
            return;
        }

        long issueId;
        try {
            issueId = Long.parseLong(issueIdParam.trim());
        } catch (NumberFormatException e) {
            JwtAuth.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid issue_id");
            return;
        }

        List<String> auditLogsJson = new ArrayList<>();
        String sql = "SELECT a.id, a.issue_id, a.actor_user_id, a.old_status, a.new_status, a.remarks, a.created_at, " +
                "u.full_name AS actor_name, u.role AS actor_role " +
                "FROM audit_logs a " +
                "JOIN users u ON a.actor_user_id = u.id " +
                "WHERE a.issue_id = ? " +
                "ORDER BY a.created_at DESC";

        try (Connection conn = Db.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setLong(1, issueId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String rowJson = String.format(
                            "{\"id\":%d,\"issue_id\":%d,\"actor_user_id\":%d,\"old_status\":%s,\"new_status\":\"%s\",\"remarks\":%s,\"created_at\":\"%s\",\"actor_name\":\"%s\",\"actor_role\":\"%s\"}",
                            rs.getLong("id"),
                            rs.getLong("issue_id"),
                            rs.getLong("actor_user_id"),
                            rs.getString("old_status") == null ? "null" : "\"" + JwtAuth.escapeJson(rs.getString("old_status")) + "\"",
                            JwtAuth.escapeJson(rs.getString("new_status")),
                            rs.getString("remarks") == null ? "null" : "\"" + JwtAuth.escapeJson(rs.getString("remarks")) + "\"",
                            rs.getTimestamp("created_at") == null ? "" : rs.getTimestamp("created_at").toInstant().toString(),
                            JwtAuth.escapeJson(rs.getString("actor_name")),
                            JwtAuth.escapeJson(rs.getString("actor_role"))
                    );
                    auditLogsJson.add(rowJson);
                }
            }

            resp.setStatus(HttpServletResponse.SC_OK);
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.getWriter().write("[" + String.join(",", auditLogsJson) + "]");

        } catch (SQLException e) {
            JwtAuth.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error: " + e.getMessage());
        }
    }

    private void setCorsHeaders(HttpServletResponse resp) {
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
}

