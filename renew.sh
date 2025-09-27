#!/bin/bash

sudo systemctl stop kjhannah
sudo certbot renew
sudo systemctl start kjhannah
