# JoliToken - Elasticsearch Token Explorer

This is an (alpha) Elasticsearch site Plugin to nicely expose token information for any indexed document 
and finally see what Lucene is doing under the hood on your JSON!

Ever wondered what your documents looks like? Give it a go!

![Token viewer](http://i.imgur.com/cpMyi7C.png)

This is very alpha, expect some bugs and missing features.

## Installation

    ./bin/plugin -i jolicode/jolitoken

You can then go to http://localhost:9200/_plugin/jolitoken/ and enjoy viewing your tokens.

## How does it works

It's very simple as it rely on the [Term Vectors API](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-termvectors.html).

The documentation say that we can't run term vectors if the mapping hasn't been created with the right `term_vector` option, 
but I don't want that on my clusters... So I fetch the document you want and send it as artificial document!

Then I have to do some stuff on the fields because the Term Vectors API only run on analyzed fields.
