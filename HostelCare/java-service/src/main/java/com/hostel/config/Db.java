package com.hostel.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class Db {
    static {
        try {
            Class.forName("org.postgresql.Driver");
        } catch (ClassNotFoundException ignored) {
            // Driver may be auto-loaded via SPI in JDBC 4+
        }
    }

    public static Connection getConnection() throws SQLException {
        var env = System.getenv();
        String url = env.getOrDefault("DB_URL", "jdbc:postgresql://localhost:5432/hostel_portal");
        String user = env.getOrDefault("DB_USER", "postgres");
        String pass = env.getOrDefault("DB_PASS", "postgres");
        return DriverManager.getConnection(url, user, pass);
    }
}

