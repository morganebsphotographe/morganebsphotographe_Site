/* =====================================================
   MORGANEBS - script

   CHARGEMENT AUTOMATIQUE DES PHOTOS
   ---------------------------------
   Deposez simplement vos images dans les dossiers :
       photos/portrait/
       photos/couple/
       photos/mariage/
       photos/famille/
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
    "famille"
];

/* Nom affiche pour chaque categorie */
const categoryNames = {
    portrait: "Portrait",
    couple:   "Couple",
    mariage:  "Mariage",
    famille:  "Famille"
};


/* =====================================================
   MANIFESTE DE SECOURS (optionnel)
   Sert uniquement si l'API GitHub est indisponible.
   Vous pouvez le laisser vide : le chargement auto
   fonctionne sans. Pour plus de securite, vous pouvez
   y recopier les noms de vos fichiers.
===================================================== */
const fallbackPhotos = {
    portrait: [],
    couple:   [],
    mariage:  ["1W2A9246.JPG"],
    famille:  []
};


/* Configuration manuelle du depot (optionnel).
   Laissez vide : detection automatique sur GitHub Pages.
   A remplir seulement en cas de domaine personnalise. */
const REPO = {
    username:   "",   // ex : "morganebsphotographe"
    repository: "",   // ex : "morganebsphotographe_Site"
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
   Cache navigateur (session) pour les listes de fichiers
===================================================== */

function cacheKey(category) {
    const repo = repoName() || "repo";
    return "mbs:" + repo + ":" + category;
}

function readCache(category) {
    try {
        const raw = sessionStorage.getItem(cacheKey(category));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return null;
        return data;
    } catch (e) {
        return null;
    }
}

function writeCache(category, names) {
    try {
        sessionStorage.setItem(cacheKey(category), JSON.stringify(names));
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


/* =====================================================
   Recuperation des photos d'une categorie
   (cache -> API GitHub -> manifeste de secours)
===================================================== */

async function getImages(category) {

    // 1) Cache de session
    const cached = readCache(category);
    if (cached) {
        return toPhotos(category, cached);
    }

    // 2) API GitHub
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
                console.warn("[MorganeBS] API GitHub : quota temporairement depasse. " +
                    "Utilisation du manifeste de secours pour '" + category + "'. " +
                    "Cela n'affecte pas vos visiteurs (quota par adresse IP).");
            } else {
                console.warn("[MorganeBS] API GitHub : reponse " + response.status +
                    " pour '" + category + "'.");
            }
        } catch (error) {
            console.warn("[MorganeBS] API GitHub injoignable pour '" + category + "'.", error);
        }
    }

    // 3) Manifeste de secours
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
    image.alt = prettyName(photo.name) + " · " + categoryNames[photo.category];
    image.loading = "lazy";

    imageWrapper.appendChild(image);

    const caption = document.createElement("div");
    caption.className = "work-caption";

    const name = document.createElement("span");
    name.textContent = prettyName(photo.name);

    const category = document.createElement("span");
    category.textContent = categoryNames[photo.category];

    caption.appendChild(name);
    caption.appendChild(category);

    work.appendChild(imageWrapper);
    work.appendChild(caption);

    return work;
}


/* Message affiche quand aucune photo n'est trouvee */
function emptyMessage(target) {
    target.innerHTML =
        '<p class="loading-note">' +
        'Les photographies apparaitront ici automatiquement. ' +
        'Ajoutez vos images dans les dossiers ' +
        '<code>photos/portrait</code>, <code>photos/couple</code>, ' +
        '<code>photos/mariage</code>, <code>photos/famille</code> du depot, ' +
        'puis publiez le site.' +
        '</p>';
}


/* =====================================================
   HOME - apercu (6 photos)
===================================================== */

async function loadHomeGallery() {

    const gallery = document.getElementById("home-gallery");
    if (!gallery) return;

    const images = await getAllImages();

    gallery.innerHTML = "";

    if (images.length === 0) {
        emptyMessage(gallery);
        return;
    }

    images.slice(0, 6).forEach(photo => {
        gallery.appendChild(createPhoto(photo));
    });

    revealNewCards(gallery);
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
    revealNewCards(gallery);
}


/* =====================================================
   HERO - premiere photo disponible
===================================================== */

async function loadHero() {

    const container = document.getElementById("hero-image");
    if (!container) return;

    let images = await getImages("portrait");
    if (images.length === 0) {
        images = await getAllImages();
    }
    if (images.length === 0) return;

    const image = document.createElement("img");
    image.src = images[0].url;
    image.alt = "Photographie de MorganeBS";
    container.appendChild(image);
    container.classList.add("has-image");
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


function revealNewCards(container) {
    if (revealObserver && container.classList.contains("reveal")) {
        revealObserver.observe(container);
    }
}
