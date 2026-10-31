POCKETJS_SDK ?= $(HOME)/development/.pocketjs-star-drift-sdk
BUN ?= $(HOME)/.bun/bin/bun
PKG := dist/pocketshell.pocket

.PHONY: build check deploy preview clean distclean

build:            ## compile app/ into dist/pocketshell.pocket
	POCKETJS_SDK="$(POCKETJS_SDK)" BUN="$(BUN)" ./scripts/build.sh

check: build      ## admission-check the package with the device's own runtime
	./scripts/check.sh $(PKG)

deploy: check     ## push the package over ADB and restart the frontend (no image rebuild)
	./scripts/deploy.sh $(PKG)

preview:          ## browser harness for layout/colour work (no device)
	@echo "open http://127.0.0.1:8099/browser-preview.html"
	cd app && python3 -m http.server 8099 --bind 127.0.0.1

desktop:          ## build + restart the launcher window on the desktop host (HX90)
	./scripts/desktop-run.sh

clean:
	rm -f $(PKG) dist/frame-after-deploy.raw dist/frame-after-deploy.png

distclean: clean
	rm -rf dist
