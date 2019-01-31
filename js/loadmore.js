/*jslint browser: true, maxerr: 50, indent: 2 */
/*global jQuery: false */
(function ($) {
  "use strict";

    function load_more_blog_posts() {
        // Load More Portfolio
        console.log(window.load_more_blog_posts);
        if (window.load_more_blog_posts) {

            var pageNum = parseInt(load_more_blog_posts.startPage) + 1;

            // The maximum number of pages the current query can return.
            var max = parseInt(load_more_blog_posts.maxPage);

            // The link of the next page of posts.
            var nextLink = load_more_blog_posts.nextLink;

            // wrapper selector
            var wrap_selector = '.blog.metro';

            //button click
            $('.js-load-more').on('click', function (e) {

                var $btn = $(this),
                    $btnText = $btn.html();
                $btn.html('loading...');

                if (pageNum <= max) {

                    var $container = $(wrap_selector);
                    $.ajax({
                        url: nextLink,
                        type: "get",
                        success: function (data) {

                            var newElements = $(data).find('.blog-.metro .post');
                            var elems = [];

                            newElements.each(function (i) {
                                elems.push(this);
                            });
                            $container.append(elems);
                            $container.find('img[data-lazy-src]').foxlazy();

                            wpc_add_img_bg('.s-img-switch');

                            $('img[data-lazy-src]').foxlazy();
                            pageNum++;
                            nextLink = nextLink.replace(/\/page\/[0-9]?/, '/page/' + pageNum);

                            $btn.html($btnText);

                            if (pageNum == ( max + 1 )) {
                                $btn.hide('fast');
                            }
                        }
                    });
                }
                return false;
            });
        }
    }

    $(window).on('load', function () {
        load_more_blog_posts();
    });

}(jQuery));
