#!/bin/bash

case "$1" in
        stop|restart)
        forever $1 server.js
                ;;
        *)
		forever -al /mnt/backup/logs/node/vodacom/server.log $1 server.js vodacomza
		exit 1
esac
