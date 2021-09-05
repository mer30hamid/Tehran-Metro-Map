# Tehran Metro Map
Tehran Metro Map using [d3-tube-map](https://github.com/johnwalley/d3-tube-map) based on [official map](https://metro.tehran.ir/)

### Demo
visit https://mer30hamid.github.io/Tehran-Metro-Map/ for demo

### Run local
Even if the application only uses client side javascript, you still need to run a small web server to prevent *CORS* errors, because of loading *json* files from the local filesystem. A simple option would be Python's `SimpleHTTPServer` (or `http.server`, depending on the version of Python installed.). More about it [here](https://developer.mozilla.org/en-US/docs/Learn/Common_questions/set_up_a_local_testing_server)

```bash
> cd Tehran-Metro-Map
> python -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

![image](https://user-images.githubusercontent.com/1561497/132138356-acc8f064-c129-4cd9-9208-b4c45a617cbc.png)
