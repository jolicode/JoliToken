var JoliToken = (function() {
    var host;

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

    var getLabelColor = function(count) {
        if (count > 50) { return 'danger' }
        if (count > 30) { return 'warning' }
        if (count > 10) { return 'primary' }

        return 'default';
    };

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

                if (count > 1) {
                    row += ' <span class="label label-';

                    row += getLabelColor(count);
                    row += '">' + sortable[term].term + ' <span>(' +count+ ')</span></span> ';
                } else {
                    row += ' <span class="label label-default">' + sortable[term].term  + '</span>';
                }
            });

            row += "</li>";

            vectorsHtml += row;
        });

        vectorsHtml += "</ul>";

        $('#vectors')[ nested ? 'append' : 'prepend' ](vectorsHtml);
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
                    } else if (typeof (properties[property].properties) !== "undefined") {
                        fullPath += "." + property;
                        iterateOnProperties(properties[property].properties, source[property], fullPath);
                    }
                }
            }
        }

        iterateOnProperties(mapping, source, "");

        return nestedObjects;
    };

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

    var init = function () {
        var hostField = $('#host');
        host = hostField.val();

        computeIndexList();

        // @todo populate list of index/types

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
