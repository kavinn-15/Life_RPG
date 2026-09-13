package com.liferpg.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    @Value("${frontend.url:https://life-rpg-orcin.vercel.app}")
    private String frontendUrl;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Allow Vercel production, preview URLs, custom domain, and localhost environments
        configuration.setAllowedOriginPatterns(List.of(
                "https://life-rpg-orcin.vercel.app",
                "https://life-rpg-git-main-powerhouse14.vercel.app",
                "https://life-nhalban4h-powerhouse14.vercel.app",
                "https://*.vercel.app",
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                frontendUrl
        ));

        // Allowed HTTP methods
        configuration.setAllowedMethods(Arrays.asList(
                "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"
        ));

        // Allowed request headers (supports JWT Bearer authorization and JSON payloads)
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "X-Requested-With",
                "Accept",
                "Origin",
                "Access-Control-Request-Method",
                "Access-Control-Request-Headers"
        ));

        // Exposed response headers
        configuration.setExposedHeaders(Arrays.asList(
                "Authorization",
                "Content-Disposition"
        ));

        // Enable credentials (JWT Authorization headers, cookies, etc.)
        configuration.setAllowCredentials(true);

        // Cache preflight OPTIONS responses for 1 hour (3600 seconds)
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}