(function () {
    var footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.className = 'footer';
    footer.innerHTML =
        '<div class="row align-items-center">' +
            '<div class="col-xs-12 col-6">' +
                '<div class="footer-socials text-left">' +
                    '<a href="https://twitter.com/clkruse" target="_blank"><i class="fa fa-twitter"></i></a>' +
                    '<a href="https://www.instagram.com/clkruse" target="_blank"><i class="fa fa-instagram"></i></a>' +
                '</div>' +
            '</div>' +
            '<div class="col-xs-12 col-6">' +
                '<p class="copyright">© Caleb Kruse, ' + new Date().getFullYear() + '</p>' +
            '</div>' +
        '</div>';
})();
