/**
 * If you have time to read this, maybe you have to contribute? YAY :)
 *
 * @type {{init}}
 */
var JoliToken = (function() {
    var host;

    /**
     * Display ugly alert() to user when something goes bad
     * @param e
     */
    var handleError = function(e) {
        var msg = "Error: ";

        if (e.responseJSON && e.responseJSON.error) {
            msg += e.responseJSON.error;
        } else if (e.responseText) {
            msg += e.responseText;
        } else {
            msg += e.statusText;
        }

        alert(msg);
    };

    /**
     * From a count of token, get a color. Totally arbitrary.
     *
     * @param count
     * @returns {*}
     */
    var getLabelColor = function(count) {
        if (count > 45) { return 'danger' }
        if (count > 20) { return 'warning' }
        if (count > 5) { return 'primary' }

        return 'default';
    };

    /**
     * Update the select dropdown with a list of index/type fetched from the server
     */
    var computeIndexList = function() {
        var displayHidden = $('#hiddenIndices').is(':checked');

        $.getJSON(host + "_mapping").done(function(mapping) {
            var options = "";

            for (var indexName in mapping) {
                if (mapping.hasOwnProperty(indexName)) {
                    for (var typeName in mapping[indexName].mappings) {
                        if (mapping[indexName].mappings.hasOwnProperty(typeName)) {
                            if (!displayHidden && indexName[0] === '.') {
                                continue;
                            }

                            var key = indexName + '/' + typeName;
                            options += '<option value="' + key + '">' + key + '</option>';
                        }
                    }
                }
            }

            $('#path').html(options);
        }).fail(handleError);
    };

    /**
     * Actually display the vectors
     *
     * @param vectors   The vectors. Yep.
     * @param source    The original doc (the nested one for nested)
     * @param nested    False when it's the real doc, a path when it's nested
     * @returns {null}
     */
    var doDisplay = function (vectors, source, nested) {
        if (!vectors.found) {
            // @todo display error?
            return null;
        }

        var vectorsHtml = nested !== false ? "<h5>Nested " + nested + "</h5>" : "<h4>Tokens</h4>";
        vectorsHtml += "<ul>";

        $.each(vectors.term_vectors, function(path) {
            var currentPathTerms = vectors.term_vectors[path].terms;
            var row = "<li>";

            row += "<strong>" + path + "</strong>: ";

            var sortable = [];
            for (var term in currentPathTerms) {
                if (currentPathTerms.hasOwnProperty(term)) {
                    sortable.push({term: term, object: vectors.term_vectors[path].terms[term]})
                }
            }

            // Sort them by count
            sortable.sort(function(a, b) {
                return (a.object.tokens.length < b.object.tokens.length) ? 1 : -1;
            });

            $.each(sortable, function(term) {
                var count = sortable[term].object.tokens.length;
                var title = "doc_freq: " + sortable[term].object.doc_freq + ", term_freq: " + sortable[term].object.term_freq + ", ttf: " + sortable[term].object.ttf;

                row += ' <span data-toggle="tooltip" data-placement="top" title="' + title + '" class="label label-';
                row += getLabelColor(count);
                row += '">' + sortable[term].term;

                if (count > 1) {
                    row += ' <span>(' +count+ ')</span>';
                }

                row += '</span>';
            });

            row += "</li>";

            vectorsHtml += row;
        });

        vectorsHtml += "</ul>";

        $('#vectors')[ nested ? 'append' : 'prepend' ](vectorsHtml);

        // Heavy?
        $(function () {
            $('[data-toggle="tooltip"]').tooltip()
        })
    };

    /**
     * Return the nested documents by reading the Mapping and the Source!
     *
     * @param source
     * @returns {Array}
     */
    var getNestedDocuments = function (source) {
        var path        = $('#path').val();
        var indexName   = path.split('/')[0];
        var typeName    = path.split('/')[1];
        var mapping     = {};

        $.ajax({
            type: "GET",
            url: host + path + "/_mapping",
            success: function(data) {
                mapping = data[indexName].mappings[typeName].properties;
            },
            dataType: "json",
            async: false
        });

        var nestedObjects = [];

        function iterateOnProperties(properties, source, fullPath) {
            for (var property in properties) {
                if (properties.hasOwnProperty(property)) {
                    if (properties[property].type === "nested") {
                        fullPath += "." + property;
                        for (var subObject in source[property]) {
                            if (source[property].hasOwnProperty(subObject)) {
                                nestedObjects.push({fullPath: fullPath, source: source[property][subObject]});
                            }
                        }
                    } else if (typeof (properties[property].properties) !== "undefined" && typeof (source[property]) !== "undefined") {
                        fullPath += "." + property;
                        iterateOnProperties(properties[property].properties, source[property], fullPath);
                    }
                }
            }
        }

        iterateOnProperties(mapping, source, "");

        return nestedObjects;
    };

    /**
     * For a source document, fetch the vectors for the API
     *
     * @param source
     * @param path
     * @param nested
     */
    var doFetchTermVectors = function (source, path, nested) {
        var payload = {
            doc: source,
            offsets : true,
            positions : true,
            term_statistics : true,
            field_statistics : false
        };

        $.ajax({
            type: "POST",
            url: host + path + "/_termvector",
            data: JSON.stringify(payload),
            success: function(data) {
                doDisplay(data, source, nested);
            },
            dataType: "json"
        });
    };

    /**
     * Start the Callback Hell :)
     */
    var startDisplayDocToken = function () {
        var path        = $('#path').val();
        var identifier  = $('#identifier').val();

        // Get the full document _source
        $.getJSON(host + path + "/" + identifier + "/_source").done(function(source) {
            // Doc exists!
            var results = $('#results');
            $('#vectors').html('');
            results.removeClass('hidden');

            // @todo color
            $('#originalDoc').html(JSON.stringify(source, undefined, 1));

            // Do the doc has any nested fields? Because the Term Vector API does not load them...
            var nestedDocuments = getNestedDocuments(source);

            doFetchTermVectors(source, path, false);

            for (var nestedDocument in nestedDocuments) {
                if (nestedDocuments.hasOwnProperty(nestedDocument)) {
                    doFetchTermVectors(nestedDocuments[nestedDocument].source, path, nestedDocuments[nestedDocument].fullPath);
                }
            }
        }).fail(handleError);
    };

    /**
     * Bind some events and make it works.
     */
    var init = function () {
        var hostField = $('#host');
        host = hostField.val();

        computeIndexList();

        $('#doc').submit(function(e) {
            e.preventDefault();

            startDisplayDocToken();
        });

        hostField.closest('form').submit(function(e) {
            e.preventDefault();

            host = hostField.val();
            computeIndexList();
        });

        $('#hiddenIndices').on('change', function() {
            computeIndexList();
        })
    };

    return {
        init: init
    }
})();
