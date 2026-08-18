/* =====================================================
   MORGANEBS - script

   CHARGEMENT AUTOMATIQUE DES PHOTOS
   ---------------------------------
   Deposez simplement vos images dans les dossiers :
       photos/portrait/
       photos/couple/
       photos/mariage/
       photos/famille/
       photos/animalier/
       photos/grossesse/
   Elles apparaissent automatiquement sur le site.
   (Formats acceptes : jpg, jpeg, png, webp, avif -
    les majuscules d'extension .JPG sont acceptees.)

   Comment ca marche :
   - Le site lit le contenu des dossiers via l'API GitHub.
   - Les listes sont mises en cache dans le navigateur
     (le temps de la session) pour eviter de solliciter
     l'API a chaque page et rester rapide.
   - Si l'API est momentanement indisponible, le site
     utilise le manifeste de secours ci-dessous.
===================================================== */


/* Ordre d'affichage des categories */
const categories = [
    "portrait",
    "couple",
    "mariage",
    "famille",
    "animalier",
    "grossesse"
];

/* Nom affiche pour chaque categorie */
const categoryNames = {
    portrait:  "Portrait",
    couple:    "Couple",
    mariage:   "Mariage",
    famille:   "Famille",
    animalier: "Animalier",
    grossesse: "Grossesse"
};


/* =====================================================
   MANIFESTE DE SECOURS (optionnel)
   Sert uniquement si l'API GitHub est indisponible.
   Vous pouvez le laisser vide : le chargement auto
   fonctionne sans. Pour plus de securite, vous pouvez
   y recopier les noms de vos fichiers.
===================================================== */
const fallbackPhotos = {
    portrait:  [],
    couple:    [],
    mariage:   ["1W2A9246.JPG", "1W2A9259.JPG"],
    famille:   [],
    animalier: [],
    grossesse: []
};


/* Configuration du depot GitHub.
   Renseignee en dur : le chargement des photos continue de
   fonctionner meme si le site passe un jour sur un nom de
   domaine personnalise (qui ne contient plus ".github.io"). */
const REPO = {
    username:   "morganebsphotographe",
    repository: "morganebsphotographe_Site",
    branch:     "main"
};


/* =====================================================
   Detection du depot GitHub
===================================================== */

function getGithubInfo() {

    if (REPO.username && REPO.repository) {
        return {
            username: REPO.username,
            repository: REPO.repository,
            branch: REPO.branch || "main"
        };
    }

    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    let username = "";
    let repository = "";

    if (hostname.endsWith(".github.io")) {
        username = hostname.split(".")[0];
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length && !parts[0].includes(".")) {
            repository = parts[0];
        }
    }

    return { username, repository, branch: REPO.branch || "main" };
}


/* Nom du repo effectif (gere le cas "user site") */
function repoName() {
    const { username, repository } = getGithubInfo();
    if (!username) return null;
    return repository || (username + ".github.io");
}


/* Base des URLs brutes des images */
function rawBase() {
    const { username, branch } = getGithubInfo();
    const repo = repoName();
    if (!username || !repo) return null;
    return "https://raw.githubusercontent.com/" +
        username + "/" + repo + "/" + branch + "/photos";
}


/* URL API pour lister un dossier */
function apiUrl(category) {
    const { username } = getGithubInfo();
    const repo = repoName();
    if (!username || !repo) return null;
    return "https://api.github.com/repos/" +
        username + "/" + repo + "/contents/photos/" + category;
}


/* =====================================================
   Cache navigateur des listes de fichiers
   -----------------------------------------------------
   On memorise la liste des photos de chaque categorie
   dans le navigateur pendant CACHE_TTL. Tant que le cache
   est valide, on N'APPELLE PAS l'API GitHub : les
   rechargements de page restent instantanes et le quota
   (60 requetes/heure) n'est pas sollicite.
   Le cache se rafraichit tout seul apres CACHE_TTL, donc
   les nouvelles photos apparaissent d'elles-memes.
===================================================== */

/* Duree de validite du cache : 10 minutes */
const CACHE_TTL = 10 * 60 * 1000;

function cacheKey(category) {
    const repo = repoName() || "repo";
    return "mbs:" + repo + ":" + category;
}

/* Lecture : renvoie la liste si le cache est encore valide */
function readCache(category) {
    try {
        const raw = localStorage.getItem(cacheKey(category));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.names)) return null;
        if (Date.now() - data.time > CACHE_TTL) return null; // expire
        return data.names;
    } catch (e) {
        return null;
    }
}

/* Lecture "de secours" : renvoie la derniere liste connue,
   MEME si elle est expiree (utile si l'API est bloquee). */
function readStaleCache(category) {
    try {
        const raw = localStorage.getItem(cacheKey(category));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.names)) return null;
        return data.names;
    } catch (e) {
        return null;
    }
}

function writeCache(category, names) {
    try {
        localStorage.setItem(
            cacheKey(category),
            JSON.stringify({ names: names, time: Date.now() })
        );
    } catch (e) {
        /* stockage indisponible : on ignore */
    }
}


/* Transforme une liste de noms en objets photo */
function toPhotos(category, names) {
    const base = rawBase();
    if (!base) return [];
    return names.map(name => ({
        name: name,
        category: category,
        url: base + "/" + category + "/" + encodeURIComponent(name)
    }));
}


/* Vide le cache des photos.
   Astuce : ajoutez "?refresh" a la fin de l'adresse du site
   (ex : ...github.io/...Site/?refresh) pour forcer le
   rechargement immediat apres avoir ajoute des photos. */
function clearPhotoCache() {
    try {
        categories.forEach(function (c) {
            localStorage.removeItem(cacheKey(c));
        });
    } catch (e) { /* ignore */ }
}

if (typeof window !== "undefined" &&
    window.location &&
    window.location.search.indexOf("refresh") !== -1) {
    clearPhotoCache();
}


/* =====================================================
   Recuperation des photos d'une categorie
   Ordre : cache valide -> API GitHub -> cache expire
   (si API bloquee) -> manifeste de secours
===================================================== */

async function getImages(category) {

    // 1) Cache encore valide : pas d'appel API
    const cached = readCache(category);
    if (cached) {
        return toPhotos(category, cached);
    }

    // 2) API GitHub (chargement automatique)
    const url = apiUrl(category);

    if (url) {
        try {
            const response = await fetch(url);

            if (response.ok) {
                const files = await response.json();

                if (Array.isArray(files)) {
                    const names = files
                        .filter(f =>
                            f.type === "file" &&
                            /\.(jpg|jpeg|png|webp|avif)$/i.test(f.name)
                        )
                        .map(f => f.name);

                    writeCache(category, names);
                    return toPhotos(category, names);
                }
            } else if (response.status === 403) {
                console.warn("[MorganeBS] API GitHub : quota temporairement depasse (60 req/h). " +
                    "Utilisation de la derniere liste connue pour '" + category + "'.");
            } else {
                console.warn("[MorganeBS] API GitHub : reponse " + response.status +
                    " pour '" + category + "'.");
            }
        } catch (error) {
            console.warn("[MorganeBS] API GitHub injoignable pour '" + category + "'.", error);
        }
    }

    // 3) API indisponible : on reutilise la derniere liste connue (meme expiree)
    const stale = readStaleCache(category);
    if (stale && stale.length) {
        return toPhotos(category, stale);
    }

    // 4) Dernier recours : manifeste de secours
    const fb = fallbackPhotos[category] || [];
    return toPhotos(category, fb);
}


/* Toutes les categories, dans l'ordre defini */
async function getAllImages() {
    const results = await Promise.all(
        categories.map(category => getImages(category))
    );
    return results.flat();
}


/* =====================================================
   Creation d'une carte photo
===================================================== */

function prettyName(filename) {
    return filename
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .trim();
}


function createPhoto(photo) {

    const work = document.createElement("article");
    work.className = "work";
    work.dataset.category = photo.category;

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "work-image";

    const image = document.createElement("img");
    image.src = photo.url;
    image.alt = "Photographie " + categoryNames[photo.category] + " - MorganeBS";
    image.loading = "lazy";

    /* Fondu doux quand l'image est chargee (evite l'apparition brutale) */
    if (image.complete && image.naturalWidth) {
        image.classList.add("loaded");
    } else {
        image.addEventListener("load", function () {
            image.classList.add("loaded");
        });
        image.addEventListener("error", function () {
            image.classList.add("loaded");
        });
    }

    imageWrapper.appendChild(image);

    // Legende : uniquement la categorie (jamais le nom du fichier)
    const caption = document.createElement("div");
    caption.className = "work-caption";

    const category = document.createElement("span");
    category.textContent = categoryNames[photo.category];

    caption.appendChild(category);

    work.appendChild(imageWrapper);
    work.appendChild(caption);

    /* Ouverture de la visionneuse au clic / au clavier */
    work.dataset.src = photo.url;
    work.dataset.label = categoryNames[photo.category];
    work.setAttribute("role", "button");
    work.setAttribute("tabindex", "0");
    work.setAttribute("aria-label", "Agrandir cette photographie");

    return work;
}


/* Message affiche quand aucune photo n'est trouvee */
function emptyMessage(target) {
    target.innerHTML =
        '<p class="loading-note">' +
        'Les photographies apparaitront ici automatiquement. ' +
        'Ajoutez vos images dans les dossiers ' +
        '<code>photos/portrait</code>, <code>photos/couple</code>, ' +
        '<code>photos/mariage</code>, <code>photos/famille</code>, ' +
        '<code>photos/animalier</code>, <code>photos/grossesse</code> du depot, ' +
        'puis publiez le site.' +
        '</p>';
}


/* =====================================================
   HOME - apercu : 3 photos de categories differentes,
   choisies au hasard a chaque chargement.
===================================================== */

/* Melange un tableau (Fisher-Yates) */
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* Choisit jusqu'a 3 photos, en privilegiant des categories differentes */
function pickThree(images) {

    // Regrouper par categorie
    const byCat = {};
    images.forEach(p => {
        (byCat[p.category] = byCat[p.category] || []).push(p);
    });

    // Categories disponibles, dans un ordre aleatoire
    const cats = shuffle(Object.keys(byCat));

    const chosen = [];
    const used = new Set();

    // 1) une photo au hasard par categorie differente
    cats.forEach(cat => {
        if (chosen.length >= 3) return;
        const pick = shuffle(byCat[cat])[0];
        chosen.push(pick);
        used.add(pick.url);
    });

    // 2) s'il manque des photos (moins de 3 categories),
    //    completer avec d'autres photos au hasard
    if (chosen.length < 3) {
        shuffle(images).forEach(p => {
            if (chosen.length >= 3) return;
            if (!used.has(p.url)) {
                chosen.push(p);
                used.add(p.url);
            }
        });
    }

    return chosen.slice(0, 3);
}

async function loadHomeGallery() {

    const gallery = document.getElementById("home-gallery");
    if (!gallery) return;

    const images = await getAllImages();

    gallery.innerHTML = "";

    if (images.length === 0) {
        emptyMessage(gallery);
        return;
    }

    pickThree(images).forEach(photo => {
        gallery.appendChild(createPhoto(photo));
    });

    revealCards(gallery);
}


/* =====================================================
   PORTFOLIO - toutes les photos + filtres
===================================================== */

async function loadPortfolio() {

    const gallery = document.getElementById("portfolio-gallery");
    if (!gallery) return;

    const images = await getAllImages();

    gallery.innerHTML = "";

    if (images.length === 0) {
        emptyMessage(gallery);
        return;
    }

    images.forEach(photo => {
        gallery.appendChild(createPhoto(photo));
    });

    setupFilters();
    revealCards(gallery);
}


/* =====================================================
   FILTRES du portfolio
===================================================== */

function setupFilters() {

    const buttons = document.querySelectorAll(".filter");

    buttons.forEach(button => {

        button.addEventListener("click", () => {

            const category = button.dataset.category;

            buttons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            const works = document.querySelectorAll(".portfolio-gallery .work");

            works.forEach(work => {
                const show =
                    category === "all" ||
                    work.dataset.category === category;
                work.style.display = show ? "" : "none";
            });
        });
    });
}


/* =====================================================
   UI - menu mobile + reveal au scroll
===================================================== */

function initUI() {

    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector("nav");

    if (toggle && nav) {
        toggle.addEventListener("click", () => {
            const open = document.body.classList.toggle("nav-open");
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });

        nav.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                document.body.classList.remove("nav-open");
                toggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    setupReveal();
    initLightbox();
    initPhotoCursor();
}


let revealObserver = null;

function setupReveal() {

    if (!("IntersectionObserver" in window)) {
        document.querySelectorAll(".reveal").forEach(el =>
            el.classList.add("is-visible")
        );
        return;
    }

    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px"
    });

    document.querySelectorAll(".reveal").forEach(el =>
        revealObserver.observe(el)
    );
}


/* Apparition en cascade des cartes photo au scroll */
function revealCards(container) {

    const cards = container.querySelectorAll(".work");

    if (!("IntersectionObserver" in window)) {
        cards.forEach(c => c.classList.add("in"));
        return;
    }

    const obs = new IntersectionObserver((entries, o) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                // petit decalage selon la position dans la grille
                const i = Array.prototype.indexOf.call(cards, el);
                el.style.transitionDelay = (Math.min(i, 5) * 70) + "ms";
                el.classList.add("in");
                o.unobserve(el);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });

    cards.forEach(c => obs.observe(c));
}


/* Header : liseré + fond apres un leger defilement */
function initHeader() {
    const header = document.getElementById("site-header");
    if (!header || header.classList.contains("solid")) {
        // pages ou le header est deja solide en permanence (contact)
        if (header && header.dataset.always === "solid") return;
    }
    if (!header) return;

    function onScroll() {
        if (window.scrollY > 24) header.classList.add("solid");
        else header.classList.remove("solid");
    }
    // sur les pages interieures on peut vouloir le garder solide :
    if (header.classList.contains("solid")) {
        header.dataset.always = "solid";
        return;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
}


/* =====================================================
   VISIONNEUSE PLEIN ECRAN (lightbox)
   Clic sur une photo : ouverture en grand.
   Fleches gauche/droite ou balayage : navigation.
   Echap ou clic sur le fond : fermeture.
===================================================== */

let lb = null;          /* references DOM de la visionneuse */
let lbItems = [];       /* photos actuellement navigables */
let lbIndex = 0;
let lbLastFocus = null;

function initLightbox() {

    if (document.getElementById("lightbox")) return;

    /* Construction du markup une seule fois */
    const overlay = document.createElement("div");
    overlay.id = "lightbox";
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Visionneuse de photographies");
    overlay.innerHTML =
        '<button class="lightbox-close" aria-label="Fermer">' +
            '<span aria-hidden="true"></span><span aria-hidden="true"></span>' +
        '</button>' +
        '<button class="lightbox-nav lightbox-prev" aria-label="Photo precedente">&#8592;</button>' +
        '<button class="lightbox-nav lightbox-next" aria-label="Photo suivante">&#8594;</button>' +
        '<figure class="lightbox-figure">' +
            '<img alt="">' +
            '<figcaption class="lightbox-caption"></figcaption>' +
        '</figure>';

    document.body.appendChild(overlay);

    lb = {
        overlay: overlay,
        image:   overlay.querySelector("img"),
        caption: overlay.querySelector(".lightbox-caption"),
        close:   overlay.querySelector(".lightbox-close"),
        prev:    overlay.querySelector(".lightbox-prev"),
        next:    overlay.querySelector(".lightbox-next")
    };

    /* Fermeture : bouton, ou clic sur le fond (pas sur l'image) */
    lb.close.addEventListener("click", closeLightbox);
    overlay.addEventListener("click", function (e) {
        if (e.target === overlay || e.target.classList.contains("lightbox-figure")) {
            closeLightbox();
        }
    });

    lb.prev.addEventListener("click", function (e) {
        e.stopPropagation();
        stepLightbox(-1);
    });
    lb.next.addEventListener("click", function (e) {
        e.stopPropagation();
        stepLightbox(1);
    });

    /* Clavier */
    document.addEventListener("keydown", function (e) {
        if (!overlay.classList.contains("open")) return;
        if (e.key === "Escape") closeLightbox();
        else if (e.key === "ArrowLeft") stepLightbox(-1);
        else if (e.key === "ArrowRight") stepLightbox(1);
    });

    /* Balayage tactile */
    let startX = null;
    overlay.addEventListener("touchstart", function (e) {
        startX = e.touches[0].clientX;
    }, { passive: true });

    overlay.addEventListener("touchend", function (e) {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 45) stepLightbox(dx < 0 ? 1 : -1);
        startX = null;
    }, { passive: true });

    /* Ouverture : delegation, fonctionne aussi pour les cartes ajoutees plus tard */
    document.addEventListener("click", function (e) {
        const card = e.target.closest(".work");
        if (card) openLightbox(card);
    });

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        const card = document.activeElement;
        if (card && card.classList && card.classList.contains("work")) {
            e.preventDefault();
            openLightbox(card);
        }
    });
}


/* Construit la liste des photos visibles autour de celle cliquee */
function openLightbox(card) {

    if (!lb) return;

    const gallery = card.closest(".portfolio-grid, .portfolio-gallery");
    const all = gallery
        ? Array.prototype.slice.call(gallery.querySelectorAll(".work"))
        : [card];

    /* On ignore les photos masquees par un filtre */
    lbItems = all.filter(function (el) {
        return el.style.display !== "none";
    });

    lbIndex = lbItems.indexOf(card);
    if (lbIndex < 0) lbIndex = 0;

    lbLastFocus = document.activeElement;

    showLightboxItem();

    lb.overlay.classList.add("open");
    document.body.classList.add("lightbox-open");
    lb.close.focus();

    /* Fleches inutiles s'il n'y a qu'une seule photo */
    const solo = lbItems.length < 2;
    lb.prev.hidden = solo;
    lb.next.hidden = solo;
}


function showLightboxItem() {

    const card = lbItems[lbIndex];
    if (!card) return;

    lb.image.classList.remove("loaded");
    lb.image.src = card.dataset.src || "";
    lb.image.alt = "Photographie " + (card.dataset.label || "");
    lb.caption.textContent = card.dataset.label || "";

    if (lb.image.complete && lb.image.naturalWidth) {
        lb.image.classList.add("loaded");
    } else {
        lb.image.addEventListener("load", function onLoad() {
            lb.image.classList.add("loaded");
            lb.image.removeEventListener("load", onLoad);
        });
    }
}


function stepLightbox(direction) {
    if (!lbItems.length) return;
    lbIndex = (lbIndex + direction + lbItems.length) % lbItems.length;
    showLightboxItem();
}


function closeLightbox() {
    if (!lb) return;
    lb.overlay.classList.remove("open");
    document.body.classList.remove("lightbox-open");
    if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
}


/* =====================================================
   CURSEUR "VOIR" sur les photos
   Uniquement sur les appareils avec une souris.
===================================================== */

function initPhotoCursor() {

    /* Pas de curseur personnalise sur tactile ni en mouvement reduit */
    if (!window.matchMedia) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.querySelector(".photo-cursor")) return;

    const dot = document.createElement("div");
    dot.className = "photo-cursor";
    dot.textContent = "Voir";
    dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);

    let visible = false;

    document.addEventListener("mousemove", function (e) {

        dot.style.transform = "translate(" + e.clientX + "px, " + e.clientY + "px)";

        const overPhoto = !!e.target.closest(".work-image") &&
                          !document.body.classList.contains("lightbox-open");

        if (overPhoto !== visible) {
            visible = overPhoto;
            dot.classList.toggle("visible", visible);
        }
    }, { passive: true });

    /* On masque le curseur si la souris quitte la fenetre */
    document.addEventListener("mouseleave", function () {
        visible = false;
        dot.classList.remove("visible");
    });
}
