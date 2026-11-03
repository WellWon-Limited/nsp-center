universe.components = (function (universe, $, api) {
    var self = {},
        popup;

    /**
     *
     * @param options
     * @option component Component name
     * @option template Template of component
     * @option parameters Parameters of component
     * @param callback Callback function when given form code
     */
    self.get = function (options, callback) {
        options = api.extend({
            'component': null,
            'template': null,
            'parameters': null
        }, options);

        universe.page('components.get', {
            component: options.component,
            template: options.template,
            parameters: options.parameters
        }, {}, callback);
    };

    /**
     *
     * @param options Component name
     * @option component Component name
     * @option template Template of component
     * @option parameters Parameters of component
     * @option settings
     * Object like:
     * {
     *     title: 'Title of popup',
     *     parameters: {Parameters of BX.PopupWindow}
     * }
     * @param callback Callback function when end
     * Callback variables:
     * - this - BX.PopupWindow instance
     * - options - Options object
     * - fields - Fields object
     * - parameters - Parameters object of BX.PopupWindow
     */
    self.show = function (options, callback) {

        self.get(options, function (response) {
            var container;
            var settings;
            var parameters;
            var abjuster;

            if (popup) {
                popup.destroy();
            }

            settings = api.extend({}, options.settings);
            options.settings = undefined;

            container = $('<div>', {
                'style': 'display: none'
            }).append(response).appendTo($('body'));
            container = container.get(0);

            parameters = api.extend({
                content: container,
                closeIcon: {},
                zIndex: 0,
                offsetLeft: 0,
                offsetTop: 0,
                width: 450,
                overlay: true
            }, settings.parameters);

            if (settings.width)
                parameters.width = settings.width;

            if (settings.title) {
                parameters.titleBar = {
                    content: BX.create('span', {
                        html: settings.title,
                        props: {
                            className: 'access-title-bar'
                        }
                    })
                }
            }
            parameters.events = {
                onAfterPopupShow: function() {
                    var popup     = this;
                    var container = popup.popupContainer;
                    requestAnimationFrame(function() {
                        requestAnimationFrame(function() {
                            let left = (window.innerWidth - container.offsetWidth) / 2;
                            container.style.left = left + 'px';
                            let top = window.pageYOffset + 100;
                            container.style.top = top + 'px';
                        });
                    });
                }
            };
            popup = new BX.PopupWindow('UniverseComponent', null, parameters);
            popup.show();
            if (api.isFunction(callback))
                callback.call(popup, options, settings);
        });
    };

    return self;
})(universe, jQuery, intec);