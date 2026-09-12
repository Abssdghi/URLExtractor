(function () {
    "use strict";

    var ICONS = {
        broken: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 16l5-5 4 4"/><path d="M14 13l2-2 5 5"/><path d="M4 4l16 16"/></svg>',
        empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
        alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
        refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
        link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
        external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>',
        copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        searchBig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/><path d="M8.5 11h5"/></svg>'
    };

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    var stage        = $('#stage');
    var toolbar      = $('#toolbar');
    var toolbarInfo  = $('#toolbarInfo');
    var filterField  = $('#filterField');
    var filterInput  = $('#filterInput');
    var urlInput     = $('#urlInput');
    var clearBtn     = $('#clearBtn');
    var fetchBtn     = $('#fetchBtn');
    var searchForm   = $('#searchForm');
    var toastsWrap   = $('#toasts');
    var recentWrap   = $('#recentWrap');
    var recentList   = $('#recentList');
    var openPageBtn  = $('#openPageBtn');
    var copyAllBtn   = $('#copyAllBtn');

    var state = {
        url: '',
        tab: 'images',
        query: '',
        cache: new Map(),
        pending: new Set()
    };

    var responseView = 'pretty';

    var MAX_RENDER_TEXT = 400000;   // chars for raw <pre>
    var MAX_JSON_RENDER = 300000;   // serialized chars for JSON tree

    function keyFor(tab, url) { return tab + '|' + url; }
    function currentKey() { return state.url ? keyFor(state.tab, state.url) : null; }
    function currentEntry() {
        var k = currentKey();
        return k ? state.cache.get(k) : null;
    }
    function isLoading() {
        var k = currentKey();
        return k ? state.pending.has(k) : false;
    }

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function shorten(str, max) {
        var s = String(str == null ? '' : str);
        if (s.length <= max) return s;
        return s.slice(0, Math.max(1, max - 1)) + '…';
    }

    function formatBytes(n) {
        if (typeof n !== 'number' || !isFinite(n) || n < 0) return '—';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function normalizeUrl(raw) {
        var value = String(raw == null ? '' : raw).trim();
        if (!value) return '';
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
            value = 'https://' + value;
        }
        return value;
    }

    function isValidUrl(value) {
        try {
            var u = new URL(value);
            return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
        } catch (e) {
            return false;
        }
    }

    function hostOf(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); }
        catch (e) { return ''; }
    }

    function safeAbsolute(raw, base) {
        if (raw == null) return '';
        var value = String(raw).trim();
        if (!value) return '';
        try { return new URL(value, base).href; }
        catch (e) { return value; }
    }

    function toast(message, type) {
        var kind = type || 'info';
        var el = document.createElement('div');
        el.className = 'toast toast-' + kind;
        el.innerHTML = '<span class="toast-dot"></span><span>' + esc(message) + '</span>';
        toastsWrap.appendChild(el);

        requestAnimationFrame(function () { el.classList.add('is-in'); });

        setTimeout(function () {
            el.classList.remove('is-in');
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 300);
        }, 2600);
    }

    function copyText(text) {
        var value = String(text == null ? '' : text);

        return new Promise(function (resolve) {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(value).then(function () {
                    resolve(true);
                }).catch(function () {
                    resolve(legacyCopy(value));
                });
                return;
            }
            resolve(legacyCopy(value));
        });
    }

    function legacyCopy(value) {
        try {
            var ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.left = '-1000px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    }

    function proxyUrlFor(url) {
        return 'https://corsproxy.io/?key=webdemo1&url=' + encodeURIComponent(url);
    }

    function fetchWithFallback(url, options) {
        var opts = options || {};
        var attempts = [url, proxyUrlFor(url)];
        var lastError = null;

        return attempts.reduce(function (chain, target, index) {
            return chain.catch(function (previousError) {
                if (previousError) lastError = previousError;

                return fetch(target, opts).then(function (response) {
                    var isLast = index === attempts.length - 1;
                    if (response.ok || isLast) {
                        return { response: response, via: index === 0 ? 'direct' : 'proxy' };
                    }
                    var err = new Error('Request failed with status ' + response.status + (response.statusText ? ' ' + response.statusText : ''));
                    err.status = response.status;
                    throw err;
                });
            });
        }, Promise.reject(null)).catch(function (err) {
            if (err) throw err;
            throw lastError || new Error('Network request failed');
        });
    }

    function fetchHtml(url) {
        return fetchWithFallback(url, {
            method: 'GET',
            headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
        }).then(function (result) {
            if (!result.response.ok) {
                throw new Error('Request failed with status ' + result.response.status + (result.response.statusText ? ' ' + result.response.statusText : ''));
            }
            return result.response.text().then(function (html) {
                return { html: html, via: result.via };
            });
        });
    }

    function getResponse(url) {
        var started = (window.performance && performance.now) ? performance.now() : Date.now();

        return fetchWithFallback(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        }).then(function (result) {
            var response = result.response;
            return response.text().then(function (text) {
                var ended = (window.performance && performance.now) ? performance.now() : Date.now();
                var json = null;
                try { json = JSON.parse(text); } catch (e) { json = null; }

                var bytes = text.length;
                try { bytes = new Blob([text]).size; } catch (e) { bytes = text.length; }

                var contentType = '';
                try { contentType = response.headers.get('content-type') || ''; } catch (e) { contentType = ''; }

                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText || '',
                    contentType: contentType,
                    bytes: bytes,
                    durationMs: Math.max(0, Math.round(ended - started)),
                    via: result.via,
                    text: text,
                    json: json
                };
            });
        });
    }

    function parseDoc(html) {
        return new DOMParser().parseFromString(html, 'text/html');
    }

    function pickFromSrcset(srcset, base) {
        if (!srcset) return '';
        var best = '';
        var bestScore = -1;

        srcset.split(',').forEach(function (part) {
            var chunk = part.trim();
            if (!chunk) return;
            var pieces = chunk.split(/\s+/);
            var candidate = pieces[0];
            var descriptor = pieces[1] || '';
            var score = 0;

            if (/^\d+(\.\d+)?w$/.test(descriptor)) {
                score = parseFloat(descriptor);
            } else if (/^\d+(\.\d+)?x$/.test(descriptor)) {
                score = parseFloat(descriptor) * 1000;
            } else {
                score = 1;
            }

            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        });

        return best ? safeAbsolute(best, base) : '';
    }

    function extractImages(html, baseUrl) {
        var doc = parseDoc(html);
        var nodes = doc.getElementsByTagName('img');
        var out = [];
        var seen = Object.create(null);

        for (var i = 0; i < nodes.length; i++) {
            var img = nodes[i];
            var raw = img.getAttribute('src') ||
                      img.getAttribute('data-src') ||
                      img.getAttribute('data-lazy-src') ||
                      img.getAttribute('data-original') ||
                      '';

            var srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';

            if (!raw && srcset) {
                raw = pickFromSrcset(srcset, baseUrl);
            }

            if (!raw) continue;

            var absolute = safeAbsolute(raw, baseUrl);
            if (!absolute) continue;
            if (seen[absolute]) continue;
            seen[absolute] = true;

            out.push({
                src: absolute,
                raw: String(raw),
                alt: (img.getAttribute('alt') || '').replace(/\s+/g, ' ').trim(),
                width: img.getAttribute('width') || '',
                height: img.getAttribute('height') || '',
                loading: img.getAttribute('loading') || '',
                host: hostOf(absolute)
            });
        }

        return out;
    }

    function extractLinks(html, baseUrl) {
        var doc = parseDoc(html);
        var nodes = doc.getElementsByTagName('a');
        var out = [];
        var seen = Object.create(null);

        for (var i = 0; i < nodes.length; i++) {
            var a = nodes[i];
            var raw = a.getAttribute('href');
            if (!raw) continue;

            var trimmed = String(raw).trim();
            if (!trimmed) continue;
            if (/^(javascript:|mailto:|tel:|sms:|data:|#)/i.test(trimmed)) continue;

            var absolute = safeAbsolute(trimmed, baseUrl);
            if (!absolute) continue;
            if (seen[absolute]) continue;
            seen[absolute] = true;

            var text = (a.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) text = (a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();

            out.push({
                href: absolute,
                raw: trimmed,
                text: text,
                title: (a.getAttribute('title') || '').replace(/\s+/g, ' ').trim(),
                rel: a.getAttribute('rel') || '',
                target: a.getAttribute('target') || '',
                host: hostOf(absolute)
            });
        }

        return out;
    }

    function load(tab, url, opts) {
        var options = opts || {};
        var key = keyFor(tab, url);

        if (!options.force && state.cache.has(key)) {
            render();
            return Promise.resolve();
        }
        if (state.pending.has(key)) {
            return Promise.resolve();
        }
        if (options.force) {
            state.cache.delete(key);
        }

        state.pending.add(key);
        render();

        var job;

        if (tab === 'images') {
            job = fetchHtml(url).then(function (result) {
                return { items: extractImages(result.html, url), via: result.via, fetchedAt: Date.now() };
            });
        } else if (tab === 'links') {
            job = fetchHtml(url).then(function (result) {
                return { items: extractLinks(result.html, url), via: result.via, fetchedAt: Date.now() };
            });
        } else {
            job = getResponse(url);
        }

        return job.then(function (data) {
            state.cache.set(key, { ok: true, data: data });
        }).catch(function (err) {
            state.cache.set(key, {
                ok: false,
                error: (err && err.message) ? err.message : String(err)
            });
        }).then(function () {
            state.pending.delete(key);
            render();
        });
    }

    function render() {
        renderTabs();
        renderToolbar();
        renderStage();
        renderFetchButton();
    }

    function renderFetchButton() {
        var loading = isLoading();
        fetchBtn.classList.toggle('is-loading', loading);
        fetchBtn.disabled = loading;
        var label = fetchBtn.querySelector('.btn-label');
        if (label) label.textContent = loading ? 'Fetching…' : 'Fetch';
    }

    function renderTabs() {
        $$('.tab').forEach(function (tabEl) {
            var tab = tabEl.getAttribute('data-tab');
            var active = tab === state.tab;
            tabEl.classList.toggle('is-active', active);
            tabEl.setAttribute('aria-selected', active ? 'true' : 'false');

            var badge = tabEl.querySelector('.count');
            if (!badge) return;

            var entry = state.url ? state.cache.get(keyFor(tab, state.url)) : null;

            if (!entry || !entry.ok) {
                badge.hidden = true;
                return;
            }

            if (tab === 'response') {
                badge.textContent = String(entry.data.status);
            } else {
                badge.textContent = String(entry.data.items.length);
            }
            badge.hidden = false;
        });
    }

    function renderToolbar() {
        var entry = currentEntry();
        var hasData = !!(entry && entry.ok);
        var loading = isLoading();

        if (!state.url || loading) {
            toolbar.hidden = true;
            return;
        }

        if (!hasData) {
            toolbar.hidden = true;
            return;
        }

        toolbar.hidden = false;

        var filterable = state.tab === 'images' || state.tab === 'links';
        filterField.hidden = !filterable;

        var total;
        var noun;

        if (state.tab === 'images') {
            total = entry.data.items.length;
            noun = total === 1 ? 'image' : 'images';
            toolbarInfo.innerHTML = '<strong>' + total + '</strong> ' + noun + ' found · via ' + esc(entry.data.via);
        } else if (state.tab === 'links') {
            total = entry.data.items.length;
            noun = total === 1 ? 'link' : 'links';
            toolbarInfo.innerHTML = '<strong>' + total + '</strong> ' + noun + ' found · via ' + esc(entry.data.via);
        } else {
            toolbarInfo.innerHTML =
                '<strong>' + esc(String(entry.data.status)) + '</strong> ' +
                esc(entry.data.statusText || '') + ' · ' +
                esc(formatBytes(entry.data.bytes)) + ' · ' +
                esc(String(entry.data.durationMs)) + ' ms';
        }

        openPageBtn.onclick = function () {
            if (!state.url) return;
            window.open(state.url, '_blank', 'noopener,noreferrer');
        };
    }

    function renderStage() {
        stage.innerHTML = '';

        if (!state.url) {
            stage.appendChild(buildWelcomeState());
            return;
        }

        var key = currentKey();
        var entry = key ? state.cache.get(key) : null;

        if (!entry || state.pending.has(key)) {
            stage.appendChild(buildSkeleton(state.tab));
            return;
        }

        if (!entry.ok) {
            stage.appendChild(buildErrorState(entry.error));
            return;
        }

        if (state.tab === 'images') {
            stage.appendChild(buildImagesView(entry.data));
        } else if (state.tab === 'links') {
            stage.appendChild(buildLinksView(entry.data));
        } else {
            stage.appendChild(buildResponseView(entry.data));
        }
    }

    function buildWelcomeState() {
        var el = document.createElement('div');
        el.className = 'state';
        el.innerHTML =
            '<div class="state-icon">' + ICONS.searchBig + '</div>' +
            '<h3>Ready when you are</h3>' +
            '<p>Type a page address above and hit <code>Fetch</code>. Then switch between <code>Images</code>, <code>Links</code> and <code>Response</code> to explore what that page returns.</p>';
        return el;
    }

    function buildErrorState(message) {
        var el = document.createElement('div');
        el.className = 'state is-error';
        el.innerHTML =
            '<div class="state-icon">' + ICONS.alert + '</div>' +
            '<h3>Could not load that page</h3>' +
            '<p>' + esc(message || 'Unknown error. The site may block cross-origin requests or be offline.') + '</p>';

        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-primary';
        retry.innerHTML = ICONS.refresh + '<span>Try again</span>';
        retry.addEventListener('click', function () {
            if (!state.url) return;
            load(state.tab, state.url, { force: true });
        });

        el.appendChild(retry);
        return el;
    }

    function buildEmptyState(title, text) {
        var el = document.createElement('div');
        el.className = 'state';
        el.innerHTML =
            '<div class="state-icon">' + ICONS.empty + '</div>' +
            '<h3>' + esc(title) + '</h3>' +
            '<p>' + esc(text) + '</p>';
        return el;
    }

    function buildSkeleton(tab) {
        var wrap = document.createElement('div');

        if (tab === 'images') {
            wrap.className = 'grid';
            var cards = '';
            for (var i = 0; i < 8; i++) {
                cards +=
                    '<div class="card sk-card">' +
                        '<div class="sk sk-thumb"></div>' +
                        '<div class="card-body">' +
                            '<div class="sk sk-line" style="width:82%"></div>' +
                            '<div class="sk sk-line" style="width:54%"></div>' +
                            '<div class="sk sk-line" style="width:40%;margin-top:6px"></div>' +
                        '</div>' +
                    '</div>';
            }
            wrap.innerHTML = cards;
            return wrap;
        }

        if (tab === 'links') {
            wrap.className = 'list';
            var rows = '';
            for (var j = 0; j < 7; j++) {
                rows +=
                    '<div class="row sk-row">' +
                        '<div class="sk sk-dot"></div>' +
                        '<div class="row-main">' +
                            '<div class="sk sk-line" style="width:42%"></div>' +
                            '<div class="sk sk-line" style="width:68%"></div>' +
                        '</div>' +
                    '</div>';
            }
            wrap.innerHTML = rows;
            return wrap;
        }

        wrap.className = 'response-wrap';
        wrap.innerHTML =
            '<div class="meta-strip">' +
                '<div class="sk sk-line" style="width:90px;height:28px;border-radius:99px"></div>' +
                '<div class="sk sk-line" style="width:130px;height:28px;border-radius:99px"></div>' +
                '<div class="sk sk-line" style="width:70px;height:28px;border-radius:99px"></div>' +
            '</div>' +
            '<div class="code-surface" style="padding:18px">' +
                '<div class="sk sk-line" style="width:70%"></div>' +
                '<div class="sk sk-line" style="width:52%;margin-top:10px"></div>' +
                '<div class="sk sk-line" style="width:84%;margin-top:10px"></div>' +
                '<div class="sk sk-line" style="width:38%;margin-top:10px"></div>' +
                '<div class="sk sk-line" style="width:64%;margin-top:10px"></div>' +
            '</div>';
        return wrap;
    }

    function filterImages(items) {
        var q = state.query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(function (img) {
            return (img.alt && img.alt.toLowerCase().indexOf(q) !== -1) ||
                   (img.src && img.src.toLowerCase().indexOf(q) !== -1);
        });
    }

    function buildImagesView(data) {
        var items = data.items;

        if (!items.length) {
            return buildEmptyState('No images found', 'This page did not contain any <img> elements we could resolve.');
        }

        var filtered = filterImages(items);

        if (!filtered.length) {
            return buildEmptyState('No matches', 'No images match "' + state.query + '". Try a different filter.');
        }

        var grid = document.createElement('div');
        grid.className = 'grid';

        var html = filtered.map(function (img) {
            var altText = img.alt || '';
            var altClass = altText ? 'card-title' : 'card-title is-empty';
            var altLabel = altText ? altText : 'No alt text';

            return '' +
                '<figure class="card">' +
                    '<a class="thumb" href="' + esc(img.src) + '" target="_blank" rel="noopener noreferrer" title="Open full size">' +
                        '<img src="' + esc(img.src) + '" alt="' + esc(altText) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
                    '</a>' +
                    '<figcaption class="card-body">' +
                        '<p class="' + altClass + '" title="' + esc(altLabel) + '">' + esc(altLabel) + '</p>' +
                        '<p class="card-url" title="' + esc(img.src) + '">' + esc(shorten(img.src, 52)) + '</p>' +
                        '<div class="card-actions">' +
                            '<button type="button" class="chip" data-copy="' + esc(img.src) + '">' + ICONS.copy + '<span>Copy URL</span></button>' +
                            '<a class="chip" href="' + esc(img.src) + '" target="_blank" rel="noopener noreferrer">' + ICONS.external + '<span>Open</span></a>' +
                        '</div>' +
                    '</figcaption>' +
                '</figure>';
        }).join('');

        grid.innerHTML = html;
        return grid;
    }

    function filterLinks(items) {
        var q = state.query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(function (link) {
            return (link.text && link.text.toLowerCase().indexOf(q) !== -1) ||
                   (link.href && link.href.toLowerCase().indexOf(q) !== -1) ||
                   (link.title && link.title.toLowerCase().indexOf(q) !== -1);
        });
    }

    function buildLinksView(data) {
        var items = data.items;

        if (!items.length) {
            return buildEmptyState('No links found', 'This page did not contain any anchor elements with a usable href.');
        }

        var filtered = filterLinks(items);

        if (!filtered.length) {
            return buildEmptyState('No matches', 'No links match "' + state.query + '". Try a different filter.');
        }

        var list = document.createElement('div');
        list.className = 'list';

        var html = filtered.map(function (link) {
            var label = link.text || link.title || '(no text)';
            var labelClass = link.text ? 'row-title' : 'row-title is-empty';
            var domain = link.host || '';

            return '' +
                '<div class="row">' +
                    '<div class="row-icon">' + ICONS.link + '</div>' +
                    '<div class="row-main">' +
                        '<a class="' + labelClass + '" href="' + esc(link.href) + '" target="_blank" rel="noopener noreferrer" title="' + esc(label) + '">' + esc(label) + '</a>' +
                        '<div class="row-sub">' +
                            (domain ? '<span class="row-domain">' + esc(domain) + '</span>' : '') +
                            '<span class="row-url" title="' + esc(link.href) + '">' + esc(shorten(link.href, 80)) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="row-actions">' +
                        '<button type="button" class="chip" data-copy="' + esc(link.href) + '">' + ICONS.copy + '<span>Copy</span></button>' +
                        '<a class="chip" href="' + esc(link.href) + '" target="_blank" rel="noopener noreferrer">' + ICONS.external + '<span>Open</span></a>' +
                    '</div>' +
                '</div>';
        }).join('');

        list.innerHTML = html;
        return list;
    }

    function buildResponseView(data) {
        var wrap = document.createElement('div');
        wrap.className = 'response-wrap';

        var statusClass = data.ok ? 'is-ok' : 'is-bad';

        var meta = document.createElement('div');
        meta.className = 'meta-strip';
        meta.innerHTML =
            '<span class="pill ' + statusClass + '">' + esc(String(data.status)) + (data.statusText ? ' ' + esc(data.statusText) : '') + '</span>' +
            (data.contentType ? '<span class="pill">' + esc(shorten(data.contentType, 44)) + '</span>' : '') +
            '<span class="pill">' + esc(formatBytes(data.bytes)) + '</span>' +
            '<span class="pill">' + esc(String(data.durationMs)) + ' ms</span>' +
            '<span class="pill pill-muted">via ' + esc(data.via) + '</span>';
        wrap.appendChild(meta);

        var hasJson = data.json !== null && typeof data.json !== 'undefined';
        var jsonTooBig = false;

        if (hasJson) {
            try {
                jsonTooBig = JSON.stringify(data.json).length > MAX_JSON_RENDER;
            } catch (e) {
                jsonTooBig = true;
            }
        }

        var usableJson = hasJson && !jsonTooBig;
        var view = (responseView === 'pretty' && usableJson) ? 'pretty' : 'raw';

        var bar = document.createElement('div');
        bar.className = 'response-bar';
        bar.innerHTML =
            '<div class="seg" role="tablist" aria-label="Response view">' +
                '<button type="button" class="seg-btn ' + (view === 'pretty' ? 'is-active' : '') + '" data-view="pretty"' + (usableJson ? '' : ' disabled') + '>Pretty</button>' +
                '<button type="button" class="seg-btn ' + (view === 'raw' ? 'is-active' : '') + '" data-view="raw">Raw</button>' +
            '</div>' +
            '<button type="button" class="chip" data-action="copy-raw">' + ICONS.copy + '<span>Copy response</span></button>';
        wrap.appendChild(bar);

        var surface = document.createElement('div');
        surface.className = 'code-surface';

        if (view === 'pretty') {
            if (jsonTooBig) {
                var note = document.createElement('div');
                note.className = 'code-note';
                note.textContent = 'This JSON payload is very large — showing the raw text instead.';
                surface.appendChild(note);
            }
            surface.appendChild(buildJsonTree(data.json));
        } else {
            var text = data.text || '';
            var note2 = null;

            if (text.length > MAX_RENDER_TEXT) {
                note2 = document.createElement('div');
                note2.className = 'code-note';
                note2.textContent = 'Response truncated for display (' + text.length.toLocaleString() + ' characters total).';
            }

            var pre = document.createElement('pre');
            pre.textContent = text.length > MAX_RENDER_TEXT ? text.slice(0, MAX_RENDER_TEXT) : text;

            if (note2) surface.appendChild(note2);
            surface.appendChild(pre);
        }

        wrap.appendChild(surface);
        return wrap;
    }

    /* ---------- JSON tree ---------- */
    function valueClass(value) {
        if (value === null) return 'is-null';
        var t = typeof value;
        if (t === 'string') return 'is-string';
        if (t === 'number') return 'is-number';
        if (t === 'boolean') return 'is-boolean';
        return 'is-null';
    }

    function formatValue(value) {
        if (value === null) return 'null';
        if (typeof value === 'undefined') return 'undefined';
        if (typeof value === 'string') return '"' + value + '"';
        return String(value);
    }

    function buildJsonNode(key, value, depth) {
        var isObject = value !== null && typeof value === 'object';

        if (!isObject) {
            var leaf = document.createElement('div');
            leaf.className = 'jn-leaf';
            leaf.innerHTML =
                '<span class="jn-key">' + esc(key) + '</span>' +
                '<span class="jn-colon">:</span>' +
                '<span class="jn-val ' + valueClass(value) + '">' + esc(formatValue(value)) + '</span>';
            return leaf;
        }

        var isArray = Array.isArray(value);
        var entries = isArray
            ? value.map(function (v, i) { return [String(i), v]; })
            : Object.keys(value).map(function (k) { return [k, value[k]]; });

        var details = document.createElement('details');
        details.className = 'jn-branch';
        details.open = depth < 2;

        var summary = document.createElement('summary');
        var openBracket = isArray ? '[' : '{';
        var closeBracket = isArray ? ']' : '}';
        var countLabel = entries.length + ' ' + (
            isArray
                ? (entries.length === 1 ? 'item' : 'items')
                : (entries.length === 1 ? 'key' : 'keys')
        );
        summary.innerHTML =
            '<span class="jn-key">' + esc(key) + '</span>' +
            '<span class="jn-colon">:</span>' +
            '<span class="jn-preview">' + esc(openBracket + ' ' + countLabel + ' ' + closeBracket) + '</span>';
        details.appendChild(summary);

        var children = document.createElement('div');
        children.className = 'jn-children';

        if (entries.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'jn-empty';
            empty.textContent = isArray ? '[]' : '{}';
            children.appendChild(empty);
        } else {
            entries.forEach(function (pair) {
                children.appendChild(buildJsonNode(pair[0], pair[1], depth + 1));
            });
        }

        details.appendChild(children);
        return details;
    }

    function buildJsonTree(data) {
        var root = document.createElement('div');
        root.className = 'json-tree';

        var isContainer = data !== null && typeof data === 'object';

        if (!isContainer) {
            root.appendChild(buildJsonNode('value', data, 0));
            return root;
        }

        var entries = Array.isArray(data)
            ? data.map(function (v, i) { return [String(i), v]; })
            : Object.keys(data).map(function (k) { return [k, data[k]]; });

        if (entries.length === 0) {
            var emptyNode = document.createElement('div');
            emptyNode.className = 'jn-empty';
            emptyNode.textContent = Array.isArray(data) ? '[]' : '{}';
            root.appendChild(emptyNode);
            return root;
        }

        entries.forEach(function (pair) {
            root.appendChild(buildJsonNode(pair[0], pair[1], 0));
        });

        return root;
    }

    searchForm.addEventListener('submit', function (event) {
        event.preventDefault();
        handleSubmit();
    });

    function handleSubmit() {
        var raw = urlInput.value;
        var url = normalizeUrl(raw);

        if (!url) {
            toast('Please enter a URL first', 'error');
            urlInput.focus();
            return;
        }

        if (!isValidUrl(url)) {
            toast('That does not look like a valid URL', 'error');
            urlInput.focus();
            return;
        }

        urlInput.value = url;
        syncClearButton();

        if (state.url !== url) {
            responseView = 'pretty';
            state.query = '';
            filterInput.value = '';
        }

        state.url = url;
        addRecent(url);

        load(state.tab, url, { force: true });
    }

    /* Clear button */
    function syncClearButton() {
        clearBtn.hidden = urlInput.value.length === 0;
    }

    urlInput.addEventListener('input', syncClearButton);

    clearBtn.addEventListener('click', function () {
        urlInput.value = '';
        syncClearButton();
        urlInput.focus();
    });

    /* Keyboard shortcuts */
    document.addEventListener('keydown', function (event) {
        var isMac = navigator.platform ? /Mac|iPhone|iPad/.test(navigator.platform) : false;
        var modifier = isMac ? event.metaKey : event.ctrlKey;

        if (modifier && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            urlInput.focus();
            urlInput.select();
        }

        if (event.key === 'Escape' && document.activeElement === urlInput) {
            urlInput.blur();
        }

        if (event.key === 'Escape' && document.activeElement === filterInput) {
            filterInput.value = '';
            state.query = '';
            renderStage();
            filterInput.blur();
        }
    });

    /* Tabs */
    $$('.tab').forEach(function (tabEl) {
        tabEl.addEventListener('click', function () {
            var tab = tabEl.getAttribute('data-tab');
            if (state.tab === tab) return;

            state.tab = tab;
            state.query = '';
            filterInput.value = '';
            responseView = 'pretty';
            render();

            if (state.url) {
                var key = keyFor(tab, state.url);
                if (!state.cache.has(key) && !state.pending.has(key)) {
                    load(tab, state.url);
                }
            }
        });
    });

    /* Filter */
    filterInput.addEventListener('input', function () {
        state.query = filterInput.value;
        renderStage();
    });

    /* Copy all */
    copyAllBtn.addEventListener('click', function () {
        var entry = currentEntry();
        if (!entry || !entry.ok) {
            toast('Nothing to copy', 'error');
            return;
        }

        var text = '';

        if (state.tab === 'images') {
            text = filterImages(entry.data.items).map(function (img) { return img.src; }).join('\n');
        } else if (state.tab === 'links') {
            text = filterLinks(entry.data.items).map(function (link) {
                return (link.text || '(no text)') + ' — ' + link.href;
            }).join('\n');
        } else {
            text = entry.data.text || '';
        }

        if (!text) {
            toast('Nothing to copy', 'error');
            return;
        }

        copyText(text).then(function (ok) {
            toast(ok ? 'Copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
        });
    });

    /* Delegated stage interactions */
    stage.addEventListener('click', function (event) {
        var viewBtn = event.target.closest ? event.target.closest('[data-view]') : null;

        if (viewBtn) {
            var view = viewBtn.getAttribute('data-view');
            if (view && !viewBtn.disabled) {
                responseView = view;
                renderStage();
            }
            return;
        }

        var actionBtn = event.target.closest ? event.target.closest('[data-action]') : null;

        if (actionBtn) {
            var action = actionBtn.getAttribute('data-action');

            if (action === 'copy-raw') {
                var entry = currentEntry();
                if (entry && entry.ok && entry.data && typeof entry.data.text === 'string') {
                    copyText(entry.data.text).then(function (ok) {
                        toast(ok ? 'Response copied' : 'Copy failed', ok ? 'success' : 'error');
                    });
                } else {
                    toast('Nothing to copy', 'error');
                }
            }
            return;
        }

        var copyBtn = event.target.closest ? event.target.closest('[data-copy]') : null;

        if (copyBtn) {
            event.preventDefault();
            var value = copyBtn.getAttribute('data-copy') || '';
            copyText(value).then(function (ok) {
                toast(ok ? 'Copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
            });
        }
    });

    /* Broken image handling (capture phase — error events do not bubble) */
    stage.addEventListener('error', function (event) {
        var el = event.target;

        if (!el || el.tagName !== 'IMG') return;
        if (el.getAttribute('data-failed') === '1') return;

        el.setAttribute('data-failed', '1');

        var fallback = document.createElement('div');
        fallback.className = 'thumb-fallback';
        fallback.innerHTML = ICONS.broken + '<span>Preview unavailable</span>';

        if (el.parentNode) {
            el.parentNode.replaceChild(fallback, el);
        }
    }, true);

    var RECENT_KEY = 'url-extractor:recent';

    function loadRecent() {
        try {
            var raw = localStorage.getItem(RECENT_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(function (item) { return typeof item === 'string'; }).slice(0, 6);
        } catch (e) {
            return [];
        }
    }

    function saveRecent(list) {
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(list));
        } catch (e) {
            /* storage unavailable — silently ignore */
        }
    }

    function addRecent(url) {
        var list = loadRecent().filter(function (item) { return item !== url; });
        list.unshift(url);
        list = list.slice(0, 5);
        saveRecent(list);
        renderRecent();
    }

    function renderRecent() {
        var list = loadRecent();

        if (!list.length) {
            recentWrap.hidden = true;
            recentList.innerHTML = '';
            return;
        }

        recentWrap.hidden = false;
        recentList.innerHTML = list.map(function (url) {
            return '<button type="button" class="recent-chip" data-url="' + esc(url) + '" title="' + esc(url) + '">' + esc(shorten(url, 34)) + '</button>';
        }).join('');
    }

    recentList.addEventListener('click', function (event) {
        var chip = event.target.closest ? event.target.closest('[data-url]') : null;
        if (!chip) return;

        var url = chip.getAttribute('data-url');
        if (!url) return;

        urlInput.value = url;
        syncClearButton();
        handleSubmit();
    });

    function boot() {
        syncClearButton();
        renderRecent();
        render();
        urlInput.focus();
    }

    boot();
})();

