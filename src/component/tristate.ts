export function setup_tristate_fns() {
    // Return a filter value from the tristate function
    $.fn.tristateValue = function () {
        switch ($(this).data('state')) {
            case 1:
                return 1;
            case 2:
                return 0;
            default: // uninit or 0
                return undefined;
        }
    };
    $.fn.tristateSetState = function (state) {
        let elem = $(this);

        elem.data('state', state);
        elem.removeClass('ui-icon-check ui-icon-minus').addClass('ui-btn-icon-left');
        if (state == 1) elem.addClass('ui-icon-check');
        else if (state == 2) elem.addClass('ui-icon-minus');

        elem.trigger('change');
    };

    // tristate controls
    $('body').on('click', '.tristate', function () {
        let elem = $(this);

        // 0 unknown, 1 yes, 2 no
        let state = elem.data('state') || 0;
        elem.tristateSetState((state = (state + 1) % 3));
    });

    // This exec's after the dom has been modified by jqm
    $(document).on('pageinit', (e) => {
        $(e.target).find('.tristate').addClass('ui-btn-icon-left');
    });
}
