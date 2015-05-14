FROM node:0.10.35
MAINTAINER James Lal [:lightsofapollo]
COPY . /npm-cache

# Install pip mostly so gaia can run...
RUN apt-get update && apt-get install -y python-pip git-core python-virtualenv && pip install virtualenv

WORKDIR /npm-cache
RUN npm install && npm run-script prepublish && npm link
ENTRYPOINT ["/npm-cache/entrypoint.sh"]
