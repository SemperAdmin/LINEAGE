#!/usr/bin/env python3
"""Stage index.html for a cloud.gov push, refusing to stage a file whose
digest does not match the published one.

The deployed copy arrives over the network, so the operator cannot hash what
they ran. This is the last point at which anyone checks, so it is checked here.

Usage, from the deploy directory:   python3 prepare.py
"""
import hashlib, os, shutil, sys

EXPECTED = "5d5a25be0ae955c268461215031355faf146f24d87df335d615fb87a4ba1ad39"

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, "..", "index.html")
dst_dir = os.path.join(here, "public")
dst = os.path.join(dst_dir, "index.html")

if not os.path.exists(src):
    sys.exit("index.html not found at %s" % os.path.abspath(src))

data = open(src, "rb").read()
got = hashlib.sha256(data).hexdigest()

print("source   %s" % os.path.abspath(src))
print("size     %d bytes" % len(data))
print("sha256   %s" % got)

if got != EXPECTED:
    print("expected %s" % EXPECTED)
    sys.exit(
        "\nREFUSING TO STAGE. The digest does not match the published build.\n"
        "Either index.html was edited without the record being updated, or this\n"
        "is not the build the README and the verification record describe.\n"
        "Re-run the acceptance suite, publish the new digest in the README, the\n"
        "verification record, and EXPECTED in this script, then stage again."
    )

os.makedirs(dst_dir, exist_ok=True)
shutil.copy2(src, dst)
print("\nstaged   %s" % os.path.abspath(dst))
print("digest matches the published build. Ready for cf push.")
