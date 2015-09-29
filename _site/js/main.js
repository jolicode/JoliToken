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
        $.getJSON(host + "_mapping").done(function(mapping) {
            var options = "";

            for (var indexName in mapping) {
                if (mapping.hasOwnProperty(indexName)) {
                    for (var typeName in mapping[indexName].mappings) {
                        if (mapping[indexName].mappings.hasOwnProperty(typeName)) {
                            var key = indexName + '/' + typeName;
                            options += '<option value="' + key + '">' + key + '</option>';
                        }
                    }
                }
            }

            $('#path').html(options);
        }).fail(handleError);
    };

    var doDisplay = function (vectors, source) {
        if (!vectors.found) {
            // @todo display error?
            return null;
        }

        var results = $('#results');
        results.removeClass('hidden');

        // @todo color
        $('#originalDoc').html(JSON.stringify(source, undefined, 1));

        var vectorsHtml = "";
        console.log(vectors);

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

        $('#vectors').html(vectorsHtml);
    };

    var displayDocToken = function () {
        var path        = $('#path').val();
        var identifier  = $('#identifier').val();

        // Get the full document _source
        $.getJSON(host + path + "/" + identifier + "/_source").done(function(source) {
            console.log(source);

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
                    doDisplay(data, source);
                },
                dataType: "json"
            });
        }).fail(handleError);
    };

    var init = function () {
        host = $('#host').val();

        computeIndexList();

        // @todo populate list of index/types

        $('#doc').submit(function(e) {
            e.preventDefault();

            displayDocToken();
        });
    };

    return {
        init: init
    }
})();
