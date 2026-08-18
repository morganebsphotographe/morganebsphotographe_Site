/* =====================================================
   MORGANEBS - script

   DEUX MODES DE CHARGEMENT DES PHOTOS
   -----------------------------------
   1) MANIFESTE (recommande, 100% fiable) :
      Ecrivez simplement le nom de vos fichiers dans la
      liste "photos" ci-dessous, sous la bonne categorie.
      Les images sont chargees directement, sans limite.

   2) AUTO via API GitHub (repli) :
      Si une categorie est laissee VIDE dans le manifeste,
      le script tente de lister automatiquement le dossier
      correspondant via l'API GitHub. Attention : l'API est
      limitee a 60 requetes/heure et par adresse IP, donc ce
      mode peut echouer si vous rechargez souvent la page.

   Pour ajouter une photo : deposez le fichier dans
   photos/<categorie>/ sur GitHub, puis ajoutez son nom
   exact (avec l'extension) dans la liste ci-dessous.
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
   MANIFESTE DES PHOTOS
   Ajoutez ici le nom EXACT de chaque fichier (avec son
   extension, majuscules comprises), sous sa categorie.
   Laissez une categorie vide ( [] ) pour tenter l'API.
===================================================== */
const photos = {

    portrait: [
        // "ma-photo.jpg",
        // "autre-photo.JPG",
    ],

    couple: [
        // "couple-01.jpg",
    ],

    mariage: [
        "1W2A9246.JPG",
    ],

    famille: [
        // "famille-01.jpg",
    ]

};


/* =====================================================
   Detection du compte / depot GitHub
   - GitHub Pages projet : compte.github.io/mon-repo
   - GitHub Pages user   : compte.github.io
   - Repli manuel possible via REPO ci-dessous
===================================================== */

/* Si la detection automatique echoue (ex : domaine
   personnalise), renseignez ces deux valeurs a la main. */
const REPO = {
    username:   "",   // ex : "morganebsphotographe"
    repository: "",   // ex : "morganebsphotographe_Site"
    branch:     "main"
};


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

        // 1er segment = nom du repo, sauf si c'est un fichier .html
        if (parts.length && !parts[0].includes(".")) {
            repository = parts[0];
        }
    }

    return { username, repository, branch: REPO.branch || "main" };
}


/* Base des URLs brutes des images */
function rawBase() {

    const { username, repository, branch } = getGithubInfo();

    if (!username) return null;

    // Repo "user site" : compte.github.io
    const repo = repository || (username + ".github.io");

    return "https://raw.githubusercontent.com/" +
        username + "/" + repo + "/" + branch + "/photos";
}


/* URL API pour lister un dossier (mode repli) */
function apiUrl(category) {

    const { username, repository } = getGithubInfo();
    if (!username) return null;

    const repo = repository || (username + ".github.io");

    return "https://api.github.com/repos/" +
        username + "/" + repo + "/contents/photos/" + category;
}


/* =====================================================
   Recuperation des photos d'une categorie
===================================================== */

async function getImages(category) {

    const base = rawBase();
    if (!base) {
        console.error("[MorganeBS] Impossible de determiner le depot GitHub. " +
            "Renseignez REPO.username et REPO.repository dans script.js.");
        return [];
    }

    const listed = photos[category] || [];

    // MODE 1 : manifeste rempli -> URLs directes
    if (listed.length > 0) {
        return listed.map(name => ({
            name: name,
            category: category,
            url: base + "/" + category + "/" + encodeURIComponent(name)
        }));
    }

    // MODE 2 : repli via API GitHub
    const url = apiUrl(category);
    if (!url) return [];

    try {
        const response = await fetch(url);

        if (response.status === 403) {
            console.warn("[MorganeBS] API GitHub : quota depasse (60 req/h). " +
                "Categorie '" + category + "' non chargee. " +
                "Ajoutez vos fichiers dans le manifeste 'photos' de script.js pour eviter ce probleme.");
            return [];
        }

        if (!response.ok) {
            console.warn("[MorganeBS] API GitHub : reponse " + response.status +
                " pour la categorie '" + category + "'.");
            return [];
        }

        const files = await response.json();
        if (!Array.isArray(files)) return [];

        return files
            .filter(file =>
                file.type === "file" &&
                /\.(jpg|jpeg|png|webp|avif)$/i.test(file.name)
            )
            .map(file => ({
                name: file.name,
                category: category,
                url: base + "/" + category + "/" + encodeURIComponent(file.name)
            }));

    } catch (error) {
        console.error("[MorganeBS] Erreur de chargement (" + category + ") :", error);
        return [];
    }
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
        'Aucune photo a afficher. Ajoutez le nom de vos fichiers dans le ' +
        'manifeste <code>photos</code> de <code>script.js</code> ' +
        '(categories : portrait, couple, mariage, famille), ' +
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
   HERO - premiere photo de la categorie "portrait"
   (repli : premiere photo toutes categories)
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
