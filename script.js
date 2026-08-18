/* =====================================================
   MORGANEBS - script
   Photos chargées automatiquement depuis le dossier
   /photos/<catégorie> du dépôt GitHub (via l'API GitHub).
   Fonctionne une fois le site publié sur GitHub Pages.
===================================================== */

const categories = [
    "portrait",
    "couple",
    "mariage",
    "famille"
];

const categoryNames = {
    portrait: "Portrait",
    couple:   "Couple",
    mariage:  "Mariage",
    famille:  "Famille"
};


/* =====================================================
   Détection du compte / dépôt GitHub
   - GitHub Pages projet : morgane.github.io/mon-repo
   - GitHub Pages user   : morgane.github.io
===================================================== */

function getGithubInfo() {

    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    let username = "";
    let repository = "";

    if (hostname.endsWith(".github.io")) {

        username = hostname.split(".")[0];

        const parts = pathname.split("/").filter(Boolean);

        // Si le 1er segment est un fichier .html, il n'y a pas de repo dans l'URL
        if (parts.length && !parts[0].includes(".")) {
            repository = parts[0];
        }
    }

    return { username, repository };
}


/* Construit la base des URLs bruteS des photos */

function buildBase(username, repository) {

    if (repository) {
        return {
            api: `https://api.github.com/repos/${username}/${repository}/contents/photos`,
            raw: `https://raw.githubusercontent.com/${username}/${repository}/main/photos`
        };
    }

    // Dépôt "user site" : le repo s'appelle username.github.io
    return {
        api: `https://api.github.com/repos/${username}/${username}.github.io/contents/photos`,
        raw: `https://raw.githubusercontent.com/${username}/${username}.github.io/main/photos`
    };
}


/* =====================================================
   Récupération des photos d'une catégorie
===================================================== */

async function getImages(category) {

    const { username, repository } = getGithubInfo();

    if (!username) {
        return [];
    }

    const { api, raw } = buildBase(username, repository);
    const url = `${api}/${category}`;

    try {

        const response = await fetch(url);

        if (!response.ok) {
            return [];
        }

        const files = await response.json();

        if (!Array.isArray(files)) {
            return [];
        }

        return files
            .filter(file =>
                file.type === "file" &&
                /\.(jpg|jpeg|png|webp|avif)$/i.test(file.name)
            )
            .map(file => ({
                name: file.name,
                category: category,
                url: `${raw}/${category}/${encodeURIComponent(file.name)}`
            }));

    } catch (error) {
        console.error("Erreur de chargement (" + category + ") :", error);
        return [];
    }
}


/* Toutes les catégories, dans l'ordre défini */

async function getAllImages() {

    const results = await Promise.all(
        categories.map(category => getImages(category))
    );

    return results.flat();
}


/* =====================================================
   Création d'une carte photo
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


/* Message affiché quand aucune photo n'est trouvée */

function emptyMessage(target) {
    target.innerHTML =
        '<p class="loading-note">' +
        'Aucune photo pour le moment. Ajoutez vos images dans ' +
        '<code>photos/portrait</code>, <code>photos/couple</code>, ' +
        '<code>photos/mariage</code> ou <code>photos/famille</code>, ' +
        'puis publiez le site sur GitHub Pages.' +
        '</p>';
}


/* =====================================================
   HOME - aperçu (6 photos)
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
   HERO - première photo de la catégorie "portrait"
   (repli : première photo toutes catégories)
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

            const photos = document.querySelectorAll(
                ".portfolio-gallery .work"
            );

            photos.forEach(photo => {
                const show =
                    category === "all" ||
                    photo.dataset.category === category;
                photo.style.display = show ? "" : "none";
            });
        });
    });
}


/* =====================================================
   UI - menu mobile + reveal au scroll
===================================================== */

function initUI() {

    /* Menu mobile */
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

    /* Reveal au scroll */
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


/* Applique un léger reveal aux cartes ajoutées dynamiquement */

function revealNewCards(container) {
    // le conteneur .reveal parent se révèle déjà ; rien de plus nécessaire ici
    if (revealObserver && container.classList.contains("reveal")) {
        revealObserver.observe(container);
    }
}
