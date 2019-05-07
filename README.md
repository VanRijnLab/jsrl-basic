# jsrl-basic

A basic Javascript implementation of SlimStampen/RUGged Learning, using [jsPsych](https://www.jspsych.org/).

## Usage

### Option 1: Run on a local PHP server

Start the server:

    cd jsrl && php -S localhost:8080

Access the webpage: [localhost:8080/us-towns.html](localhost:8080/us-towns.html)



### Option 2: Run in Docker

Docker needs to be given ownership of the data folder (only once) [(details)](https://stackoverflow.com/questions/3740152/how-do-i-set-chmod-for-a-folder-and-all-of-its-subfolders-and-files):

    sudo chown -R 33:33 jsrl/data

(Depending on the system's permissions setup, read access may also need to be given for the whole directory.)

Launch the server:

    sudo docker-compose up

The Docker setup launches three containers: a basic nginx web server, a PHP server, and an OpenCPU R server that we can send R computations to (rather than having to do them in JavaScript in the browser). The OpenCPU server is not used in the basic example (`us-towns.html`), so it is commented out in `docker-compose.yml`.

The web server listens on a non-standard port (currently set to 44392 in `docker-compose.yml`, but this can be changed) to allow multiple such servers running simultaneously on the same domain.
In my own setup I have a central Nginx server that redirects traffic coming in on port 80 to the desired web server based on the URL.
I include the following in `/etc/nginx/sites-available/default` to reroute `example.com/jsrl-basic` to this server:

    server {
        listen 80;

        location /jsrl-basic {
            proxy_pass http://127.0.0.1:44392/;
            proxy_redirect http://127.0.0.1:44392/ $scheme://$host/;
        }
    }



You can then access the webpage at this domain: [example.com/jsrl-basic/us-towns.html](example.com/jsrl-basic/us-towns.html)


### Data

Data is saved in the `jsrl/data` folder (only at the end of the task) and persists when the containers are shut down.

