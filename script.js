const categories = [
    "portrait",
    "paysage",
    "reportage",
    "editorial"
];


const categoryNames = {
    portrait: "Portrait",
    paysage: "Paysage",
    reportage: "Reportage",
    editorial: "Éditorial"
};


/*
    Détecte automatiquement :

    ton compte GitHub
    ton repository
    la branche main
*/

function getGitHubInfo() {

    const hostname = window.location.hostname;

    const pathname = window.location.pathname;

    let username = "";
    let repository = "";


    if (hostname.includes("github.io")) {

        username = hostname.split(".")[0];

        const parts =
            pathname
                .split("/")
                .filter(Boolean);

        repository = parts[0] || "";

    }


    return {
        username,
        repository
    };

}


async function getImages(category) {

    const {
        username,
        repository
    } = getGitHubInfo();


    if (!username || !repository) {

        console.error(
            "Impossible de détecter le repository GitHub."
        );

        return [];

    }


    const url =
        `https://api.github.com/repos/${username}/${repository}/contents/photos/${category}`;


    try {

        const response =
            await fetch(url);


        if (!response.ok) {

            return [];

        }


        const files =
            await response.json();


        return files

            .filter(file =>
                file.type === "file" &&
                /\.(jpg|jpeg|png|webp)$/i.test(file.name)
            )

            .map(file => ({

                name: file.name,

                category: category,

                url:
                    `https://raw.githubusercontent.com/${username}/${repository}/main/photos/${category}/${encodeURIComponent(file.name)}`

            }));

    }

    catch (error) {

        console.error(error);

        return [];

    }

}


async function getAllImages() {

    const results =
        await Promise.all(
            categories.map(
                category => getImages(category)
            )
        );


    return results.flat();

}


function createPhoto(photo) {

    const card =
        document.createElement("article");


    card.className =
        "photo-card";


    card.dataset.category =
        photo.category;


    const image =
        document.createElement("img");


    image.src =
        photo.url;


    image.alt =
        photo.name;


    image.loading =
        "lazy";


    const info =
        document.createElement("div");


    info.className =
        "photo-info";


    const name =
        document.createElement("span");


    name.textContent =
        photo.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[-_]/g, " ");


    const category =
        document.createElement("span");


    category.textContent =
        categoryNames[photo.category];


    info.appendChild(name);

    info.appendChild(category);


    card.appendChild(image);

    card.appendChild(info);


    return card;

}


/* HOME */

async function loadHomeGallery() {

    const gallery =
        document.getElementById(
            "home-gallery"
        );


    if (!gallery) return;


    const images =
        await getAllImages();


    gallery.innerHTML = "";


    images
        .slice(0, 6)
        .forEach(photo => {

            gallery.appendChild(
                createPhoto(photo)
            );

        });

}


/* PORTFOLIO */

async function loadPortfolio() {

    const gallery =
        document.getElementById(
            "portfolio-gallery"
        );


    if (!gallery) return;


    const images =
        await getAllImages();


    gallery.innerHTML = "";


    images.forEach(photo => {

        gallery.appendChild(
            createPhoto(photo)
        );

    });


    setupFilters();

}


/* FILTERS */

function setupFilters() {

    const buttons =
        document.querySelectorAll(
            ".filter"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const category =
                    button.dataset.category;


                buttons.forEach(btn =>
                    btn.classList.remove("active")
                );


                button.classList.add("active");


                const photos =
                    document.querySelectorAll(
                        ".portfolio-gallery .photo-card"
                    );


                photos.forEach(photo => {

                    if (
                        category === "all" ||
                        photo.dataset.category === category
                    ) {

                        photo.style.display =
                            "";

                    }

                    else {

                        photo.style.display =
                            "none";

                    }

                });

            }
        );

    });

}