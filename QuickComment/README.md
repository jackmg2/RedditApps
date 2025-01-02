This bot helps you to set some comment templates to quickly comment on specific posts.

You need to set your templates as a json string array in the settings:

```
[
    {
        "title": "First comment",
        "comment": "First comment"
    },
    {
        "title": "Second comment",
        "comment": "Second comment, with comma"
    },
    {
        "title": "Line returns",
        "comment": "Using \n to set \n\n line returns"
    },
    {
        "title": "Link",
        "comment": "[Usual links are available](https://www.perdu.com)"
    }
]
```