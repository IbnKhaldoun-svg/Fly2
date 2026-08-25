package com.fly2.mobile;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://ibnkhaldoun-svg.github.io/Fly2/";
    private static final String INTERNAL_HOST = "ibnkhaldoun-svg.github.io";

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout offlinePanel;
    private TextView statusText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        setContentView(buildInterface());
        configureWebView();
        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.rgb(247, 246, 241));
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
    }

    private View buildInterface() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(247, 246, 241));
        root.setFitsSystemWindows(false);

        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int top;
            int bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                top = bars.top;
                bottom = bars.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(0, top, 0, bottom);
            return insets;
        });

        root.addView(buildHeader(), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(82)));

        FrameLayout webCard = new FrameLayout(this);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.WHITE);
        cardBg.setCornerRadius(dp(26));
        cardBg.setStroke(dp(1), Color.argb(26, 13, 102, 95));
        webCard.setBackground(cardBg);
        webCard.setClipToOutline(true);
        webCard.setElevation(dp(5));

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        cardParams.setMargins(dp(12), dp(2), dp(12), dp(8));
        root.addView(webCard, cardParams);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webCard.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(13, 102, 95)));
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP);
        webCard.addView(progressBar, progressParams);

        offlinePanel = buildOfflinePanel();
        offlinePanel.setVisibility(View.GONE);
        webCard.addView(offlinePanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        root.addView(buildBottomBar(), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));

        return root;
    }

    private View buildHeader() {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(16), dp(8), dp(12), dp(8));

        TextView badge = new TextView(this);
        badge.setText("✈");
        badge.setTextSize(19);
        badge.setGravity(Gravity.CENTER);
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(Color.rgb(13, 102, 95));
        badgeBg.setShape(GradientDrawable.OVAL);
        badge.setBackground(badgeBg);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(dp(44), dp(44));
        badgeParams.setMargins(0, 0, dp(11), 0);
        header.addView(badge, badgeParams);

        LinearLayout titleWrap = new LinearLayout(this);
        titleWrap.setOrientation(LinearLayout.VERTICAL);
        titleWrap.setGravity(Gravity.CENTER_VERTICAL);

        TextView title = new TextView(this);
        title.setText("Fly2");
        title.setTextColor(Color.rgb(23, 54, 48));
        title.setTextSize(23);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        titleWrap.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Voli reali, senza complicazioni");
        subtitle.setTextColor(Color.rgb(107, 125, 120));
        subtitle.setTextSize(11);
        titleWrap.addView(subtitle);

        header.addView(titleWrap, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        Button reload = circleButton("↻", "Aggiorna");
        reload.setOnClickListener(v -> webView.reload());
        header.addView(reload, buttonParams());

        Button browser = circleButton("↗", "Apri nel browser");
        browser.setOnClickListener(v -> openExternal(webView.getUrl() != null ? webView.getUrl() : HOME_URL));
        header.addView(browser, buttonParams());

        return header;
    }

    private Button circleButton(String text, String contentDescription) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(18);
        button.setTextColor(Color.rgb(8, 77, 72));
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setPadding(0, 0, 0, 0);
        button.setContentDescription(contentDescription);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setMinHeight(0);
        button.setMinimumHeight(0);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.WHITE);
        bg.setShape(GradientDrawable.OVAL);
        bg.setStroke(dp(1), Color.argb(35, 13, 102, 95));
        button.setBackground(bg);
        button.setElevation(dp(2));
        return button;
    }

    private LinearLayout.LayoutParams buttonParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(42), dp(42));
        params.setMargins(dp(8), 0, 0, 0);
        return params;
    }

    private LinearLayout buildBottomBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(12), dp(4), dp(12), dp(7));

        statusText = new TextView(this);
        statusText.setText("●  Online · prezzi reali");
        statusText.setTextSize(10);
        statusText.setTextColor(Color.rgb(13, 102, 95));
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(dp(14), dp(7), dp(14), dp(7));
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(Color.rgb(237, 248, 245));
        pill.setCornerRadius(dp(20));
        pill.setStroke(dp(1), Color.argb(25, 13, 102, 95));
        statusText.setBackground(pill);
        bar.addView(statusText, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return bar;
    }

    private LinearLayout buildOfflinePanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(Color.rgb(250, 250, 247));

        TextView icon = new TextView(this);
        icon.setText("✈");
        icon.setTextSize(36);
        icon.setTextColor(Color.rgb(13, 102, 95));
        panel.addView(icon);

        TextView title = new TextView(this);
        title.setText("Connessione assente");
        title.setTextSize(20);
        title.setTextColor(Color.rgb(23, 54, 48));
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.setMargins(0, dp(12), 0, dp(6));
        panel.addView(title, titleParams);

        TextView copy = new TextView(this);
        copy.setText("Fly2 ha bisogno di Internet per verificare disponibilità e prezzi reali.");
        copy.setTextSize(12);
        copy.setTextColor(Color.rgb(107, 125, 120));
        copy.setGravity(Gravity.CENTER);
        panel.addView(copy);

        Button retry = new Button(this);
        retry.setText("Riprova");
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(12);
        retry.setAllCaps(false);
        GradientDrawable retryBg = new GradientDrawable();
        retryBg.setColor(Color.rgb(13, 102, 95));
        retryBg.setCornerRadius(dp(14));
        retry.setBackground(retryBg);
        retry.setOnClickListener(v -> {
            offlinePanel.setVisibility(View.GONE);
            webView.reload();
        });
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(dp(150), dp(46));
        retryParams.setMargins(0, dp(18), 0, 0);
        panel.addView(retry, retryParams);
        return panel;
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " Fly2Android/1.0");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return routeUrl(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                setStatus("●  Connessione in corso…", false);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                offlinePanel.setVisibility(View.GONE);
                setStatus("●  Online · prezzi reali", true);
                injectNativeStyle();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    offlinePanel.setVisibility(View.VISIBLE);
                    setStatus("●  Offline", false);
                }
            }
        });

        if (!isOnline()) {
            offlinePanel.setVisibility(View.VISIBLE);
            setStatus("●  Offline", false);
        }
    }

    private boolean routeUrl(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            openExternal(uri.toString());
            return true;
        }

        String host = uri.getHost() == null ? "" : uri.getHost();
        String path = uri.getPath() == null ? "" : uri.getPath();
        if (INTERNAL_HOST.equalsIgnoreCase(host) && path.startsWith("/Fly2")) {
            return false;
        }

        openExternal(uri.toString());
        return true;
    }

    private void injectNativeStyle() {
        String css = ".topbar,.site-footer{display:none!important}" +
                "body{background:#f7f6f1!important;padding-bottom:18px!important}" +
                ".app-shell{max-width:none!important}" +
                "main{padding-top:4px!important}" +
                ".hero{padding-top:14px!important}" +
                ".search-card{box-shadow:none!important;border-radius:22px!important}" +
                ".results{scroll-margin-top:12px!important}";
        String js = "(function(){" +
                "var old=document.getElementById('fly2-native-style');if(old)old.remove();" +
                "var s=document.createElement('style');s.id='fly2-native-style';s.textContent=" +
                quoteJs(css) + ";document.head.appendChild(s);" +
                "document.documentElement.classList.add('fly2-native-app');" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    private String quoteJs(String value) {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'";
    }

    private void setStatus(String text, boolean online) {
        if (statusText == null) return;
        statusText.setText(text);
        statusText.setTextColor(online ? Color.rgb(13, 102, 95) : Color.rgb(138, 92, 24));
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void openExternal(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
