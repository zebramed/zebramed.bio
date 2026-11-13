---
layout: legal
title: Legal notice
description: Legal notice (mentions légales) of zebramed.bio, published by ZebraMed SAS.
updated: 2026-11-12
---
{% assign c = site.data.company %}
## Publisher

The website zebramed.bio is published by:

{% include legal-identity.html lang="en" %}

## Hosting

The website is hosted by {{ c.host.name }}, {{ c.host.address.en }}, telephone {{ c.host.phone }}, [github.com]({{ c.host.url }}), on its {{ c.host.service }} service.

## Intellectual property

The content of this website (texts, illustrations, animations, photographs, videos and logos, and the names ZebraMed, XenoEx, ZebraChip and FishEye) belongs to ZebraMed or is used with the permission of its owners. Any reproduction, representation or adaptation of it, in whole or in part, without ZebraMed's prior written consent is prohibited and may constitute an infringement under Articles L.335-2 et seq. of the French Intellectual Property Code.

The logos of partners, programmes and institutions remain the property of their respective owners and are shown only to identify their relationship with ZebraMed.

The Inter and Barlow typefaces are used under the SIL Open Font License 1.1.

## Personal data and cookies

This website sets no cookies and uses no audience measurement or tracking. How we handle personal data, including the emails you send us, is set out in our [privacy policy]({{ '/privacy.html' | relative_url }}). Use of the website is governed by our [terms of use]({{ '/terms.html' | relative_url }}).

## Contact

For any question about this website, write to [{{ site.email }}](mailto:{{ site.email }}).

<section id="fr" class="legal-fr" lang="fr" markdown="1">

## Mentions légales

*Version française. Dernière mise à jour : {% include date-fr.html date=page.updated %}.*

### Éditeur

Le site zebramed.bio est édité par :

{% include legal-identity.html lang="fr" %}

### Hébergement

Le site est hébergé par {{ c.host.name }}, {{ c.host.address.fr }}, téléphone {{ c.host.phone }}, [github.com]({{ c.host.url }}), au moyen de son service {{ c.host.service }}.

### Propriété intellectuelle

L'ensemble des contenus de ce site (textes, illustrations, animations, photographies, vidéos et logos, ainsi que les dénominations ZebraMed, XenoEx, ZebraChip et FishEye) est la propriété de ZebraMed ou est utilisé avec l'autorisation de leurs titulaires. Toute reproduction, représentation ou adaptation, totale ou partielle, sans l'autorisation écrite préalable de ZebraMed est interdite et est susceptible de constituer une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.

Les logos des partenaires, programmes et institutions restent la propriété de leurs titulaires respectifs et ne sont reproduits que pour identifier leur relation avec ZebraMed.

Les polices de caractères Inter et Barlow sont utilisées sous licence SIL Open Font License 1.1.

### Données personnelles et cookies

Ce site ne dépose aucun cookie et n'utilise aucun outil de mesure d'audience ni de suivi. Le traitement des données personnelles, notamment des courriels que vous nous adressez, est décrit dans notre [politique de confidentialité]({{ '/privacy.html' | relative_url }}#fr). L'utilisation du site est régie par nos [conditions d'utilisation]({{ '/terms.html' | relative_url }}#fr).

### Contact

Pour toute question relative au site, écrivez à [{{ site.email }}](mailto:{{ site.email }}).

</section>
